from pytest import mark, fixture, __version__
from handshake.services.DBService.models import (
    RunBase,
    SessionBase,
    SuiteBase,
    TaskBase,
)
from subprocess import Popen
from requests import post, Session
from requests.adapters import HTTPAdapter, Retry
from datetime import datetime, timedelta
from urllib.parse import urljoin

session: Session


@fixture(autouse=True)
async def open_server(root_dir):
    result = Popen(
        f'handshake run-app test-life-cycle "{root_dir}" -p 6978', shell=True
    )

    global session
    session = Session()

    retries = Retry(total=15, backoff_factor=0.1, status_forcelist=[500, 502, 503, 504])
    session.mount("http://", HTTPAdapter(max_retries=retries))
    yield

    # deleting sample test runs
    await RunBase.filter(projectName="test-life-cycle").all().delete()

    response = post("http://127.0.0.1:6978/bye")
    assert response.text == "1"

    assert result.wait() == 0


def savePts(suffix: str) -> str:
    return urljoin("http://127.0.0.1:6978/save/", suffix)


@mark.usefixtures("open_server")
async def test_life_cycle(root_dir):
    assert session
    response = session.get("http://127.0.0.1:6978/")
    assert response.text == "1"

    saved = datetime.now().isoformat()
    payload = dict(
        started=saved,
    )

    # REGISTRATION OF SESSION

    resp = session.put(savePts("registerSession"), json=payload)
    assert resp.status_code == 201
    session_record = await SessionBase.filter(sessionID=resp.text).first()

    # avoiding timezone info in the LHS
    assert session_record.started.isoformat()[:-6] == saved

    # REGISTRATION OF SUITE

    saved = datetime.now().isoformat()
    payload = dict(
        started=saved,
        title="sample-suite",
        retried=0,
        description="sample-description",
        suiteType="SUITE",
        session_id=str(session_record.sessionID),
        file="./test.py",
        parent="",
        tags=[],
    )

    resp = session.put(savePts("registerSuite"), json=payload)
    assert resp.status_code == 201
    assert await SuiteBase.filter(suiteID=resp.text).exists()

    suite_record = await SuiteBase.filter(suiteID=resp.text).first()
    assert suite_record.started.isoformat()[:-6] == saved
    assert suite_record.suiteType == "SUITE"

    # task_for_register_suite = await TaskBase.filter(ticketID=resp.text).first()
    # assert task_for_register_suite.picked == 0
    # assert task_for_register_suite.processed == 0

    parent = resp.text
    # REGISTRATION OF TESTS AND MARKING THEM

    for _ in range(3):
        saved = datetime.now().isoformat()
        payload = dict(
            started=saved,
            title=f"sample-test-{_}",
            retried=0,
            description="sample-description",
            suiteType="TEST",
            session_id=str(session_record.sessionID),
            file="./test.py",
            parent=parent,
            tags=[],
        )

        resp = session.put(savePts("registerSuite"), json=payload)

        test = await SuiteBase.filter(suiteID=resp.text).first()
        assert test.title == f"sample-test-{_}"
        assert test.started.isoformat()[:-6] == saved
        assert test.suiteType == "TEST"

        assert not await TaskBase.filter(ticketID=resp.text).exists()

        suite = resp.text
        errors = [
            dict(
                name="sample-error-1",
                message="sample-error-message",
                stack="sample-error-stack",
            ),
            dict(
                name="sample-error-2",
                message="sample-error-message",
                stack="sample-error-stack",
            ),
            dict(
                name="sample-error-3",
                message="sample-error-message",
                stack="sample-error-stack",
            ),
        ]
        payload = dict(
            duration=10,
            ended=(datetime.now() + timedelta(seconds=9)).isoformat(),
            suiteID=suite,
            errors=errors,
            standing="FAILED",
        )

        resp = session.put(savePts("updateSuite"), json=payload)

        assert resp.status_code == 201

        test = await SuiteBase.filter(suiteID=suite).first()
        assert test.errors == errors
        assert not await TaskBase.filter(ticketID=suite).exists()

    payload = dict(
        duration=40,
        ended=(datetime.now() + timedelta(seconds=39)).isoformat(),
        suiteID=parent,
        errors=[],
        standing="FAILED",
    )

    # MARKING TEST SUITE

    resp = session.put(savePts("updateSuite"), json=payload)
    assert resp.status_code == 201

    test = await SuiteBase.filter(suiteID=parent).first()
    assert test.standing == "YET_TO_CALC"

    parse_suite_task = await TaskBase.filter(ticketID=parent).first()
    assert not parse_suite_task.processed
    assert not parse_suite_task.picked

    # MARKING TEST SESSION

    payload = dict(
        duration=50,
        ended=(datetime.now() + timedelta(seconds=49)).isoformat(),
        passed=1,
        failed=0,
        skipped=0,
        hooks=0,
        tests=1,
        sessionID=str(session_record.sessionID),
        entityName="pytest",
        entityVersion=__version__,
        simplified=f"pytest-{__version__}",
    )
    resp = session.put(savePts("updateSession"), json=payload)
    assert resp.status_code == 201

    session_record = await SessionBase.filter(
        sessionID=session_record.sessionID
    ).first()
    assert session_record.entityVersion == __version__
    assert session_record.failed == session_record.skipped == 0

    # MARKING TEST RUN

    assert not await TaskBase.filter(ticketID=session_record.test_id).exists()
    resp = session.put("http://127.0.0.1:6978/done")
    assert resp.status_code == 200

    parse_test = await TaskBase.filter(ticketID=session_record.test_id).first()
    assert not parse_test.processed
    assert not parse_test.picked
