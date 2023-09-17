import type DetailsOfRun from "@/types/testRun";
import React, { useState, type ReactNode } from "react";
import {
    type QuickPreviewForTestRun,
    parseDetailedTestRun,
} from "@/components/parseUtils";
import RenderTimeRelativeToStart, {
    RenderDuration,
} from "@/components/Table/renderers";
import RenderPassedRate from "@/components/Charts/StackedBarChart";
import Switch from "antd/lib/switch";
import List from "antd/lib/list";
import Space from "antd/lib/space";
import Collapse from "antd/lib/collapse/Collapse";
import Card from "antd/lib/card/Card";
import dayjs from "dayjs";
import Layout from "antd/lib/layout/index";
import AreaChartForRuns from "@/components/Charts/AreaChartForRuns";
import HeaderStyles from "@/styles/header.module.css";
import Empty from "antd/lib/empty/index";
import Tooltip from "antd/lib/tooltip/index";
import Divider from "antd/lib/divider/index";
import Select from "antd/lib/select/index";
import BreadCrumb from "antd/lib/breadcrumb/Breadcrumb";
import DatePicker from "antd/lib/date-picker/index";
import FilterOutlined from "@ant-design/icons/FilterOutlined";
import crumbs from "@/components/GridView/Items";

function RunCard(props: { run: QuickPreviewForTestRun }): ReactNode {
    const formatForDate = "MMM, ddd DD YYYY  ";
    const [isTest, showTest] = useState(true);
    const item = props.run;

    return (
        <List.Item
            key={item.Link}
            actions={[
                <Space key={"space"}>
                    <RenderPassedRate
                        value={isTest ? item.Rate : item.SuitesSummary}
                        key={"chart"}
                    />
                    <Switch
                        key={"switch"}
                        defaultChecked
                        size="small"
                        checkedChildren={<>Tests</>}
                        unCheckedChildren={<>Suites</>}
                        onChange={(checked) => {
                            showTest(checked);
                        }}
                        checked={isTest}
                    />
                </Space>,
            ]}
        >
            <List.Item.Meta
                title={
                    <a href={item.Link}>{`${item.Started[0].format(
                        formatForDate
                    )} - ${item.Title}`}</a>
                }
                description={
                    <Tooltip
                        title="Start Time | End Time | Duration (in s)"
                        color="volcano"
                        placement="bottomRight"
                        arrow
                    >
                        <Space
                            size="small"
                            align="baseline"
                            split={
                                <Divider
                                    type="vertical"
                                    style={{ margin: "0px" }}
                                />
                            }
                        >
                            <RenderTimeRelativeToStart
                                value={item.Started}
                                style={{ maxWidth: "100px" }}
                            />
                            <RenderTimeRelativeToStart
                                value={item.Ended}
                                style={{ maxWidth: "100px" }}
                            />
                            <RenderDuration value={item.Duration} />
                        </Space>
                    </Tooltip>
                }
            />
        </List.Item>
    );
}

function ListOfRuns(props: { runs: DetailsOfRun[] }): ReactNode {
    const details = props.runs.map(parseDetailedTestRun).reverse();
    const firstRun = details.at(0);
    const chronological = details.slice(1);

    const today = dayjs();
    const forToday = chronological.filter((run) =>
        run.Started[0].isSame(today, "date")
    );

    const yesterday = today.subtract(1, "day");
    const forYesterday = chronological.filter((run) =>
        run.Started[0].isSame(yesterday, "date")
    );

    const thisWeek = yesterday.subtract(yesterday.get("day") + 1, "days");
    const forThisWeek = chronological.filter(
        (run) =>
            run.Started[0].isAfter(thisWeek, "date") &&
            run.Started[0].isBefore(yesterday, "date")
    );

    const data = [
        { items: [firstRun], label: "Latest Run" },
        { items: forToday, label: "Today" },
        { items: forYesterday, label: "Yesterday" },
        { items: forThisWeek, label: "This Week" },
    ]
        .filter((item) => item.items.length > 0)
        .map((item) => ({
            key: item.label,
            label: item.label,
            children: (
                <List
                    bordered
                    itemLayout="vertical"
                    size="small"
                    dataSource={item.items}
                    renderItem={(item) =>
                        item != null ? <RunCard run={item} /> : <></>
                    }
                />
            ),
        }));

    return (
        <Collapse
            size="small"
            accordion
            items={data}
            defaultActiveKey={["Latest Run"]}
        />
    );
}

function ListOfCharts(props: { runs: DetailsOfRun[] }): ReactNode {
    const [isTest, showTest] = useState(true);
    const areaChart = (
        <Card
            title="Test Runs"
            bordered={true}
            size="small"
            extra={
                <Switch
                    defaultChecked
                    checkedChildren={<>Tests</>}
                    unCheckedChildren={<>Suites</>}
                    onChange={(checked) => {
                        showTest(checked);
                    }}
                    checked={isTest}
                />
            }
        >
            <AreaChartForRuns runs={props.runs} showTest={isTest} />
        </Card>
    );

    return (
        <Space direction="vertical" style={{ width: "100%" }}>
            {areaChart}
        </Space>
    );
}

export default function GridOfRuns(props: { runs: DetailsOfRun[] }): ReactNode {
    const [selectedProjectName, filterProjectName] = useState<string>();
    const filteredRuns = props.runs.filter((run) => {
        return (
            selectedProjectName == null ||
            run.projectName === selectedProjectName
        );
    });

    if (filteredRuns.length === 0) {
        return (
            <Layout style={{ height: "100%" }}>
                <Space
                    direction="horizontal"
                    style={{ height: "100%", justifyContent: "center" }}
                >
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            props.runs.length === 0
                                ? "No Runs Found!, Please run your test suite"
                                : "No Filtered Results found"
                        }
                    />
                </Space>
            </Layout>
        );
    }

    const projectNames = Array.from(
        new Set(props.runs.map((run) => run.projectName))
    ).map((projectName) => ({ label: projectName, value: projectName }));

    return (
        <Layout style={{ margin: "6px", overflow: "hidden", height: "98vh" }}>
            <Layout.Header className={HeaderStyles.header} spellCheck>
                <Space
                    align="baseline"
                    size="large"
                    style={{ marginTop: "3px" }}
                >
                    <BreadCrumb items={crumbs()} />
                    <Divider type="vertical" />
                    <Tooltip title="Filters are on the right">
                        <FilterOutlined />
                    </Tooltip>
                    <Select
                        options={projectNames}
                        allowClear
                        value={selectedProjectName}
                        placeholder="Select Project Name"
                        style={{ minWidth: "180px" }}
                        onChange={(selected) => {
                            filterProjectName(selected);
                        }}
                    />
                    <DatePicker.RangePicker />
                </Space>
            </Layout.Header>
            <Layout hasSider>
                <Layout.Sider
                    width={350}
                    theme={"light"}
                    style={{
                        margin: "6px",
                        overflow: "auto",
                    }}
                >
                    <ListOfRuns runs={filteredRuns} />
                </Layout.Sider>
                <Layout.Content
                    style={{
                        margin: "6px",
                        overflow: "auto",
                        paddingBottom: "13px",
                    }}
                >
                    <ListOfCharts runs={filteredRuns} />
                </Layout.Content>
            </Layout>
        </Layout>
    );
}
