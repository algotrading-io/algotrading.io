import React, { memo, useRef } from "react";
import { useState, useEffect, useContext } from "react";
import {
  Typography,
  Spin,
  Table,
  Alert,
  Card,
  Row,
  Col,
  Button,
  Badge,
  Modal,
  Skeleton,
  notification,
} from "antd";
import styled from "styled-components";
import { G2, Line } from "@ant-design/charts";
import {
  LoadingOutlined,
  CaretDownFilled,
  CaretUpFilled,
  QuestionOutlined,
} from "@ant-design/icons";
import styles from "./index.module.less";
import layoutStyles from "@/layouts/index.module.less";
import subStyles from "@/pages/subscription/index.module.less";
import "./index.module.less";
import {
  getApiUrl,
  getLoginLoading,
  getDateRange,
  addDays,
  signalColors,
  signalEmojis,
  Toggle,
} from "@/utils";
import { useAuthenticator } from "@aws-amplify/ui-react";
const { Title } = Typography;
const antIcon = <LoadingOutlined style={{ fontSize: 50 }} spin />;
import { AccountContext } from "@/layouts";

const toggleLabels = { BTC: "₿", USD: "$" };

const RibbonCol = styled(Col)`
  .ant-ribbon-wrapper, .ant-card {
    height: 100%;
  }
`;
const HODL = "HODL";
const hyperdrive = "hyperdrive";
const formatBTC = (v: number) => `${Math.round(v * 10) / 10} ₿`;
const formatUSD = (v: number) => {
  if (v < 1e3) {
    return `$ ${v}`;
  } else if (v < 1e6) {
    return `$ ${v / 1e3}k`;
  }
  return `$ ${v / 1e6}M`;
};

// Look up memo vs useMemo
// https://blog.logrocket.com/react-memo-vs-usememo/
const LineChart: React.FC<any> = memo(
  ({ data, formatFx, chartRef }) => {
    const sqSize = 5;
    let triSize = Math.sqrt(Math.pow(sqSize, 2) * (4 / Math.sqrt(3)));
    triSize = triSize / 1.3;
    const config = {
      // search for symbols:
      // https://github.com/search?q=org%3Aantvis+bowtie+-filename%3A*.json+-filename%3A*.html+-filename%3A*.md&type=Code
      legend: {
        layout: 'horizontal',
        position: 'top-right',
        custom: true,
        items: [
          {
            value: HODL,
            name: HODL,
            marker: {
              symbol: 'hexagon',
              style: {
                fill: 'magenta',
                r: sqSize,
              },
            },
          },
          {
            value: hyperdrive,
            name: hyperdrive,
            marker: {
              symbol: 'hexagon',
              style: {
                fill: '#52e5ff',
                r: sqSize,
              },
            },
          },
          {
            value: 'BUY',
            name: 'BUY',
            marker: {
              symbol: 'triangle',
              style: {
                fill: 'lime',
                r: sqSize,
              },
            },
          },
          {
            value: 'SELL',
            name: 'SELL',
            marker: {
              symbol: 'triangle-down',
              style: {
                fill: 'red',
                r: sqSize,
              },
            },
          },
        ],
      },
      tooltip: {
        domStyles: {
          'g2-tooltip': {
            'border-radius': '6px',
            'background-color': 'rgba(45, 45, 45, 0.95)',
            'box-shadow': '0 0 10px black',
            color: 'rgba(255, 255, 255, 0.85)',
            opacity: 'unset'
          }
        },
        showCrosshairs: true,
        showMarkers: false,
        customItems: (originalItems: TooltipItem[]) => {
          const hyperdriveItem = originalItems[0].name === hyperdrive ? originalItems[0] : originalItems[1];
          const signal = hyperdriveItem.data.Full_Sig;
          const signalDatum = {
            color: signal ? 'lime' : 'red',
            name: 'SIGNAL',
            value: signal ? '▲ BUY' : '▼ SELL'
          };
          originalItems.push(signalDatum);
          return originalItems;
        }
      },
      autoFit: true,
      data,
      xField: "Time",
      yField: "Bal",
      seriesField: "Name",
      smooth: true,
      colorField: "Name",
      color: ({ Name }) => {
        if (Name === HODL) {
          return "magenta";
        }
        return "#52e5ff";
      },
      area: {
        style: {
          fillOpacity: 0.15,
        },
      },
      animation:
      // Why is this necessary?
      // !inBeta &&
      {
        appear: {
          animation: "wave-in",
          duration: 4000,
        },
      },
      xAxis: {
        tickCount: 10,
        grid: {
          line: {
            style: {
              lineWidth: 0,
              strokeOpacity: 0,
            },
          },
        },
      },
      yAxis: {
        label: {
          formatter: (v: any) => formatFx(v),
        },
        grid: {
          line: {
            style: {
              lineWidth: 0,
              strokeOpacity: 0,
            },
          },
        },
      },
      point: {
        shape: "breath-point",
      },
    };
    return <Line ref={chartRef} {...config} />;
  },
  (pre, next) => JSON.stringify(pre?.data) === JSON.stringify(next?.data)
);

const Page = () => {
  const { account, accountLoading } = useContext(AccountContext);
  const ribbonColors = {
    Sun: "red",
    Mon: "yellow",
    Tue: "blue",
    Wed: "pink",
    Thu: "green",
    Fri: "cyan",
    Sat: "orange",
  };
  const cardHeaderColors = {
    Sun: "#D32029",
    Mon: "#D8BD14",
    Tue: "#177DDC",
    Wed: "#CB2B83",
    Thu: "#49AA19",
    Fri: "#13A8A8",
    Sat: "#D87A16",
  };

  const caretIconSize = 50;
  const { user: loggedIn } = useAuthenticator((context) => [context.user]);
  const [previewData, setPreviewData] = useState({
    BTC: { data: [], stats: [] },
    USD: { data: [], stats: [] },
  });
  const numDaysInAWeek = 7;
  const signalDates = getDateRange(
    addDays(new Date(), -numDaysInAWeek),
    numDaysInAWeek - 1
  );
  const defaultSignals = signalDates.map((date) => ({
    Date: date.toISOString().slice(0, 10),
    Day: date.toUTCString().slice(0, 3),
    Signal: "?",
    Asset: "BTC",
  }));
  const [signalData, setSignalData] = useState(defaultSignals);
  const [toggle, setToggle] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [signalLoading, setSignalLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showSignalCard, setShowSignalCard] = useState(false);
  const [signalCardData, setSignalCardData] = useState(defaultSignals[0]);
  const [haveNewSignal, setHaveNewSignal] = useState(false);
  const [quotaReached, setQuotaReached] = useState(false);
  const loading = previewLoading || accountLoading || loginLoading;
  const inBeta = loggedIn && (account?.in_beta || account?.subscribed);
  const chartRef = useRef();

  useEffect(() => {
    // find a way to not load this for in_beta
    // simple if !inBeta or checking accountLoading and loginLoading doesn't work
    const url = `${getApiUrl({ localOverride: "prod" })}/preview`;
    fetch(url, { method: "GET" })
      .then((response) => response.json())
      .then((data) => setPreviewData(data))
      .catch((err) => console.error(err))
      .finally(() => setPreviewLoading(false));
  }, []);

  // useEffect(getAccount(loggedIn, setAccount, setAccountLoading), [loggedIn]);
  useEffect(getLoginLoading(setLoginLoading));

  const fetchSignals = () => {
    setSignalLoading(true);
    const url = `${getApiUrl()}/signals`;
    fetch(url, { method: "GET", headers: { "X-API-Key": account?.api_key } })
      .then((response) => response.json())
      .then((data) => {
        if (!("data" in data)) {
          const { message } = data;
          const pattern = /^(.[^\d]*)(.*)$/;
          const match = message.match(pattern);
          setQuotaReached(true);
          notification.error({
            duration: 10,
            message: "Quota Reached",
            description: (
              <>
                <div>{match[1]}</div>
                <div>{match[2]}</div>
              </>
            ),
          });
          setTimeout(() => {
            setQuotaReached(false);
          }, 10000);
          throw new Error(message);
        }
        return data;
      })
      .then((response) => {
        const { message, data } = response;
        notification.warning({
          duration: 10,
          message: "Quota",
          description: message,
        });
        setSignalData(data);
      })
      .then(() => setHaveNewSignal(true))
      .catch((err) => console.error(err))
      .finally(() => setSignalLoading(false));
  };
  G2.registerShape("point", "breath-point", {
    draw(cfg, container) {
      const data = cfg.data;
      const point = {
        x: cfg.x,
        y: cfg.y,
      };
      const group = container.addGroup();

      if (data.Name === hyperdrive && data.Sig !== null) {
        const fill = data.Sig ? "lime" : "red";
        const symbol = data.Sig ? "triangle" : "triangle-down";
        // const text = data.Sig ? "BUY" : "SELL";
        // const fontSize = 10;
        // group.addShape("text", {
        //   attrs: {
        //     text,
        //     x: point.x - fontSize,
        //     y: point.y - fontSize / 2,
        //     fill,
        //     fontWeight: 400,
        //     shadowOffsetX: 10,
        //     shadowOffsetY: 10,
        //     shadowBlur: 10,
        //     fontSize,
        //   },
        // });

        group.addShape("marker", {
          attrs: {
            x: point.x,
            y: point.y,
            r: 5,
            fill,
            opacity: 1,
            symbol,
          },
        });
      }

      return group;
    },
  });

  const columns = [
    { title: "Metric", dataIndex: "metric", key: "metric" },
    {
      title: <span style={{ color: "#DF00DF" }}>{HODL}</span>,
      dataIndex: HODL,
      key: HODL,
    },
    {
      title: <i style={{ color: "#52e5ff" }}>{hyperdrive}</i>,
      dataIndex: hyperdrive,
      key: hyperdrive,
    },
  ];

  const betaTitlePrefix = "New Signal:";
  const betaTitle = (
    <div className={styles.content}>
      <div className={styles.betaContainer}>
        <div className={styles.text}>{betaTitlePrefix}</div>
        <div className={styles.list}>
          <div>
            <span style={{ fontSize: "30px" }}>
              <span
                style={{
                  color: haveNewSignal
                    ? signalColors[signalData[signalData.length - 1].Signal]
                    : "lime",
                }}
                className={styles.betaItem}
              >
                &nbsp;
                {haveNewSignal
                  ? signalData[signalData.length - 1].Signal
                  : "BUY"}
              </span>
              {haveNewSignal && (
                <>
                  {signalData[signalData.length - 1].Signal === "BUY" && (
                    <span>&nbsp;</span>
                  )}
                  <span>
                    &nbsp;
                    {signalEmojis[signalData[signalData.length - 1].Signal]}
                  </span>
                </>
              )}
              {!haveNewSignal && <span>&nbsp;&nbsp;&nbsp;?</span>}
            </span>
          </div>
          <div>
            <span style={{ opacity: 0 }}>{betaTitlePrefix}</span>
            <span style={{ fontSize: "30px" }}>
              <span
                style={{
                  color: haveNewSignal
                    ? signalColors[signalData[signalData.length - 1].Signal]
                    : "#F7931A",
                }}
                className={styles.betaItem}
              >
                &nbsp;
                {haveNewSignal
                  ? signalData[signalData.length - 1].Signal
                  : "HODL"}
              </span>
              {haveNewSignal && (
                <>
                  {signalData[signalData.length - 1].Signal === "BUY" && (
                    <span>&nbsp;</span>
                  )}
                  <span>
                    &nbsp;
                    {signalEmojis[signalData[signalData.length - 1].Signal]}
                  </span>
                </>
              )}
              {!haveNewSignal && <span>&nbsp;?</span>}
            </span>
          </div>
          <div>
            <span style={{ opacity: 0 }}>{betaTitlePrefix}</span>
            <span style={{ fontSize: "30px" }}>
              <span
                style={{
                  color: haveNewSignal
                    ? signalColors[signalData[signalData.length - 1].Signal]
                    : "red",
                }}
                className={styles.betaItem}
              >
                &nbsp;
                {haveNewSignal
                  ? signalData[signalData.length - 1].Signal
                  : "SELL"}
              </span>
              {haveNewSignal && (
                <>
                  {signalData[signalData.length - 1].Signal === "BUY" && (
                    <span>&nbsp;</span>
                  )}
                  <span>
                    &nbsp;
                    {signalEmojis[signalData[signalData.length - 1].Signal]}
                  </span>
                </>
              )}
              {!haveNewSignal && <span>&nbsp;?</span>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {loggedIn && account && (
        <Alert
          message={
            inBeta
              ? "Congrats! You've been selected for the closed beta. 🎊"
              : "You are not in the closed beta, but you may receive an invitation in the future. 📧"
          }
          type={inBeta ? "success" : "warning"}
          showIcon
          closable
          style={{ marginBottom: "12px" }}
        />
      )}
      {!loading && (
        <>
          <Title>
            {inBeta ? (
              <div className={styles.parent}>
                <div className={styles.child} style={{ marginBottom: "10px" }}>
                  {betaTitle}
                </div>
                <div
                  className={styles.child}
                  style={{
                    marginBottom: "0px",
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    height: "45px",
                  }}
                >
                  {
                    <Button
                      disabled={quotaReached}
                      loading={signalLoading}
                      className={`${subStyles.subscribe} ${styles.signals} ${quotaReached && styles.disabled
                        }`}
                      onClick={fetchSignals}
                    >
                      Fetch the latest signals
                    </Button>
                  }
                </div>
              </div>
            ) : (
              "Leveraging AutoML to beat BTC"
            )}
            {/* if consecutive buy, then label BUY/HODL with green/orange diagonal split */}
            {/* same if consecutive sell, then label SELL/HODL with red/orange diagonal split */}
            {/* on the right of latest signal title or  below latest signals title but above squares row*/}
            {/* #0C2226 background color of chart - cyan*/}
            {/* #2C2246 background color of chart - magenta*/}
          </Title>
          <span
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              margin: "-12px 0px 12px 0px",
            }}
          >
            {!inBeta && (
              <>
                <Title level={5}>
                  a momentum trading strategy using{" "}
                  <a href="https://github.com/suchak1/hyperdrive">
                    <i style={{ color: "#52e5ff" }}>{hyperdrive}</i>
                  </a>
                </Title>
                <Toggle
                  var={'home'}
                  val={toggle}
                  options={[toggleLabels.BTC, toggleLabels.USD]}
                  defaultValue={toggleLabels.BTC}
                  onChange={(val: string) => setToggle(val === toggleLabels.BTC)}
                />
              </>
            )}
          </span>
        </>
      )}
      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "400px",
          }}
        >
          <Spin indicator={antIcon} />
        </div>
      ) : (
        <div className={`${styles.parent} ${styles.fullHeight}`}>
          {!inBeta && !loading && (
            <div className={`${styles.child} ${styles.chartMobile}`}>
              <LineChart
                data={toggle ? previewData.BTC.data : previewData.USD.data}
                formatFx={toggle ? formatBTC : formatUSD}
                chartRef={chartRef}
              />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center' }} className={styles.child}>
            {inBeta ? (
              <>
                <Modal
                  open={showSignalCard}
                  closable={false}
                  onCancel={() => setShowSignalCard(false)}
                  centered
                  footer={null}
                  zIndex={2000}
                ><Card
                  headStyle={{
                    background: cardHeaderColors[signalCardData.Day],
                  }}
                  title={signalCardData.Day.toUpperCase()}
                >
                    <div>
                      <span>
                        <b>{"Signal: "}</b>
                      </span>
                      <span
                        style={{
                          fontFamily: '"Courier","Courier New",monospace',
                          color:
                            signalCardData.Signal === "BUY"
                              ? "lime"
                              : signalCardData.Signal === "SELL"
                                ? "red"
                                : "inherit",
                        }}
                      >
                        {signalCardData.Signal}
                      </span>
                    </div>
                    <div>
                      <span>
                        <b>{"Date: "}</b>
                      </span>
                      <span style={{ fontFamily: '"Courier","Courier New",monospace' }}>
                        {signalCardData.Date}
                      </span>
                    </div>
                    <div>
                      <span>
                        <b>{"Asset: "}</b>
                      </span>
                      <span style={{ fontFamily: '"Courier","Courier New",monospace' }}>
                        {"BTC ("}
                        <span style={{ color: "#F7931A" }}>{"₿"}</span>
                        {")"}
                      </span>
                    </div>
                  </Card>
                </Modal>
                <div
                  style={{
                    height: "100%",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    // marginBottom: "36px",
                  }}
                >
                  <Row style={{ width: "100%" }}>
                    {signalData.map((datum, idx) => (
                      <RibbonCol key={idx} flex={1}>
                        <Badge.Ribbon
                          color={ribbonColors[datum.Day]}
                          text={<b>{datum.Day.toUpperCase()}</b>}
                        >
                          <Card
                            hoverable
                            onClick={() => {
                              setSignalCardData(datum);
                              setShowSignalCard(true);
                            }}
                            bodyStyle={{
                              display: "flex",
                              justifyContent: "center",
                              height: "100%",
                              alignItems: "center",
                            }}
                          >
                            {signalLoading && (
                              <Skeleton
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                }}
                                loading
                                active
                              />
                            )}
                            {!signalLoading &&
                              (datum.Signal === "BUY" ? (
                                <CaretUpFilled
                                  style={{
                                    fontSize: `${caretIconSize}px`,
                                    color: "lime",
                                    marginBottom: `${caretIconSize / 2}px`,
                                  }}
                                />
                              ) : datum.Signal === "SELL" ? (
                                <CaretDownFilled
                                  style={{
                                    fontSize: `${caretIconSize}px`,
                                    color: "red",
                                    marginTop: `${caretIconSize / 2}px`,
                                  }}
                                />
                              ) : (
                                <QuestionOutlined
                                  style={{ fontSize: `${caretIconSize}px` }}
                                />
                              ))}
                          </Card>
                        </Badge.Ribbon>
                      </RibbonCol>
                    ))}
                  </Row>
                </div>
              </>
            ) : (
              !loading && (
                <Table
                  style={{ width: '100%' }}
                  dataSource={
                    toggle ? previewData.BTC.stats : previewData.USD.stats
                  }
                  columns={columns}
                  pagination={false}
                  loading={loading}
                />
              )
            )}
          </div>
        </div>
      )}
    </>
    // automated portfolio management
    // using momentum based strategy

    // use this example: https://g2plot.antv.vision/en/examples/line/multiple#line-area
    // multiline chart w area obj and animation obj
    // ant design charts is react wrapper of g2plot

    // use simulated data from model
    // need to make oracle class in hyperdrive
    // and write declassified script that updates predictions.csv in models/latest each night
    // does it need latest data? then make sure api key is hidden in declassified file

    // OR EASIER:
    // have lambda predict using pickled data and combine w signals.csv (consistent simulation)

    // best soln so far:
    // hyperdrive: test predictions.csv using pca5 branch / create model workflow dispatch
    // backend: make api endpoint that combines predictions.csv with signals.csv and returns
    // backend: make endpoint that returns btc close data (including most recent close - little hard) / might use alt source
    // frontend: make js fx that calculates acct balance given close array and signals array
  );
};

Page.displayName = "Page";

export default Page;
