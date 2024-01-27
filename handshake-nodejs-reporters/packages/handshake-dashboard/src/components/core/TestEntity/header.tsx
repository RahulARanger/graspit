import type { ReactNode } from 'react';
import React, { useContext } from 'react';
import CaretRightOutlined from '@ant-design/icons/CaretRightOutlined';
import CaretLeftOutlined from '@ant-design/icons/CaretLeftOutlined';
import Space from 'antd/lib/space';
import Button from 'antd/lib/button/button';
import RenderTestType from 'src/components/utils/test-status-dot';
import Text from 'antd/lib/typography/Text';
import { Badge, Divider, Tooltip } from 'antd/lib';
import { childBadge, parentBadge, retriedBadge } from './constants';
import { StaticPercent } from 'src/components/utils/counter';
import { RenderEntityType } from 'src/components/utils/renderers';
import { DetailedContext } from 'src/types/records-in-detailed';
import type {
    ParsedSuiteRecord,
    ParsedTestRecord,
} from 'src/types/parsed-records';
import { extractNeighborSuite } from './extractors';
import RelativeTo, {
    DurationText,
} from 'src/components/utils/Datetime/relative-time';
import type { Dayjs } from 'dayjs';

export function NavigationButtons(properties: {
    selectedSuite: ParsedSuiteRecord;
    setTestID: (testID: string) => void;
}) {
    const context = useContext(DetailedContext);
    if (!context) return <></>;

    const { suites } = context;

    const current = suites['@order'].indexOf(properties.selectedSuite.Id);
    const previousSuite = extractNeighborSuite(suites, current, true);
    const nextSuite = extractNeighborSuite(suites, current, false);

    const hasPrevious = previousSuite != undefined;
    const hasNext = nextSuite != undefined;
    const hasParent =
        properties.selectedSuite.Parent != undefined &&
        properties.selectedSuite.Parent != '';

    return (
        <Space>
            <Tooltip title="Previous Suite">
                <Button
                    size="small"
                    icon={<CaretLeftOutlined />}
                    disabled={!hasPrevious}
                    title={hasPrevious ? 'Prev Retry' : 'No Retries Found'}
                    onClick={() =>
                        properties.setTestID(previousSuite?.Id as string)
                    }
                />
            </Tooltip>
            <Button
                size="small"
                onClick={() =>
                    properties.setTestID(properties.selectedSuite.Parent)
                }
                disabled={!hasParent}
            >
                Parent Suite
            </Button>
            <Tooltip title="Next Suite">
                <Button
                    size="small"
                    disabled={!hasNext}
                    icon={<CaretRightOutlined />}
                    title={hasNext ? 'Next Retry' : 'No Entities found'}
                    onClick={() =>
                        properties.setTestID(nextSuite?.Id as string)
                    }
                />
            </Tooltip>
        </Space>
    );
}

export function RightSideOfBoard(properties: {
    selected: ParsedSuiteRecord;
    setTestID: (_: string) => void;
    contributed: number;
}) {
    return (
        <Space
            split={<Divider type="vertical" />}
            style={{ paddingTop: '5px', paddingBottom: '5px' }}
        >
            <Text>
                Contributed: <StaticPercent percent={properties.contributed} />
            </Text>
            <RenderEntityType
                entityName={properties.selected.entityName}
                simplified={properties.selected.simplified}
                entityVersion={properties.selected.entityVersion}
            />
            <NavigationButtons
                selectedSuite={properties.selected}
                setTestID={properties.setTestID}
            />
        </Space>
    );
}

export default function BadgeLayer(properties: {
    selected: ParsedSuiteRecord;
}) {
    const selected = properties.selected;
    const wasRetried = selected?.Status === 'RETRIED';

    return (
        <Space align="baseline">
            {wasRetried ? (
                <Tooltip title={retriedBadge}>
                    <Badge
                        count={'REPLACED'}
                        style={{
                            fontWeight: 'bold',
                            color: 'white',
                        }}
                        color="red"
                        size="default"
                        title=""
                    />
                </Tooltip>
            ) : (
                <></>
            )}
            <Tooltip title={selected.Parent ? childBadge : parentBadge}>
                <Badge
                    count={selected.Parent ? 'CHILD' : 'PARENT'}
                    style={{
                        fontWeight: 'bold',
                        color: 'white',
                    }}
                    color={selected.Parent ? 'volcano' : 'geekblue'}
                    size="default"
                    title=""
                />
            </Tooltip>
            <RenderTestType value="SUITE" />
        </Space>
    );
}

export function DurationLayer(properties: {
    selected: ParsedSuiteRecord | ParsedTestRecord;
    wrt: Dayjs;
    offsetTop: number;
}): ReactNode {
    return (
        <Divider
            type="horizontal"
            style={{
                width: '360px',
                position: 'relative',
                marginBottom: '0px',
                marginTop: '0px',
                top: -properties.offsetTop,
            }}
        >
            <Space align="start" style={{ fontWeight: 'normal' }}>
                <RelativeTo
                    dateTime={properties.selected.Started[0]}
                    secondDateTime={properties.selected.Ended[0]}
                    wrt={properties.wrt}
                />
                <Text italic>
                    <DurationText duration={properties.selected.Duration} />
                </Text>
            </Space>
        </Divider>
    );
}
