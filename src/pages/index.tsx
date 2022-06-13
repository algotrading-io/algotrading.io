import React from "react";
import { useState, useEffect } from "react";
import {
  Typography,
  Spin,
  Table,
  Switch,
  Alert,
  Card,
  Row,
  Col,
  // Input,
  Button,
  Badge,
  Modal,
  Skeleton,
  message,
} from "antd";
// import { useWindowWidth } from "@wojtekmaj/react-hooks";
import { G2, Line } from "@ant-design/charts";
import {
  LoadingOutlined,
  CopyOutlined,
  DownOutlined,
  UpOutlined,
  CaretDownFilled,
  CaretUpFilled,
  QuestionOutlined,
} from "@ant-design/icons";
import styles from "./index.less";
import layoutStyles from "../layouts/index.less";
import "./index.less";
import swaggerSpec from "../api/spec/swagger.json";
import { getApiUrl, useLoginLoading, getDateRange, addDays } from "@/utils";
import { useAuthenticator } from "@aws-amplify/ui-react";
const { Title } = Typography;
import styled from "styled-components";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
const antIcon = <LoadingOutlined style={{ fontSize: 50 }} spin />;

swaggerSpec.servers[0].url = getApiUrl();

const Page = () => {
  // console.log(swaggerSpec);
  // fetch(swaggerSpec)
  //   .then((response) => response.text())
  //   .then((textContent) => {
  //     console.log(textContent);
  //   });
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
  const signalColors = {
    BUY: "lime",
    SELL: "red",
    HODL: "#F7931A",
  };

  const signalEmojis = {
    BUY: "🚀",
    SELL: "💥",
  };
  const caretIconSize = 50;
  const { user: loggedIn } = useAuthenticator((context) => [context.user]);
  const HODL = "HODL";
  const hyperdrive = "hyperdrive";
  const [previewData, setPreviewData] = useState({
    BTC: { data: [], stats: [] },
    USD: { data: [], stats: [] },
  });
  // const width = useWindowWidth();
  const width = 391;
  // (get utc date - 1 to 7 days before).reversed()
  // that should be default signal data w Asset: BTC and Signal: ?, and proper Date formatting
  // YYYY-MM-DD and Day formatting .slice(0, 3)
  const numDaysInAWeek = 7;
  const signalDates = getDateRange(
    addDays(new Date(), -numDaysInAWeek),
    numDaysInAWeek - 1
  );
  const defaultSignals = signalDates.map((date) => ({
    Date: date.toISOString().slice(0, 10),
    Day: date.toDateString().slice(0, 3),
    Signal: "?",
    Asset: "BTC",
  }));
  const [signalData, setSignalData] = useState(defaultSignals);
  const [toggle, setToggle] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(false);
  const [signalLoading, setSignalLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showSignalCard, setShowSignalCard] = useState(false);
  const [signalCardData, setSignalCardData] = useState(defaultSignals[0]);
  const [haveNewSignal, setHaveNewSignal] = useState(false);
  const loading = previewLoading || accountLoading || loginLoading;
  const [account, setAccount] = useState();
  const inBeta = loggedIn && account?.permissions?.in_beta;
  const formatBTC = (v: number) => `${Math.round(v * 10) / 10} ₿`;
  const formatUSD = (v: number) => {
    if (v < 1e3) {
      return `$ ${v}`;
    } else if (v < 1e6) {
      return `$ ${v / 1e3}k`;
    }
    return `$ ${v / 1e6}M`;
  };
  useEffect(() => {
    const url = `${getApiUrl({ localOverride: "prod" })}/preview`;
    fetch(url, { method: "GET" })
      .then((response) => response.json())
      .then((data) => setPreviewData(data))
      .catch((err) => console.error(err))
      .finally(() => setPreviewLoading(false));
  }, []);

  useEffect(() => {
    if (loggedIn) {
      setAccountLoading(true);
      const { idToken } = loggedIn.signInUserSession;
      const url = `${getApiUrl()}/account`;
      // remove this after debugging
      setAccount({ api_key: "a".repeat(86), permissions: { in_beta: true } });
      fetch(url, {
        method: "GET",
        headers: { Authorization: idToken.jwtToken },
      })
        .then((response) => response.json())
        .then((data) => setAccount(data))
        .catch((err) => console.error(err))
        .finally(() => setAccountLoading(false));
    }
  }, [loggedIn]);

  useEffect(useLoginLoading(setLoginLoading));

  const fetchSignals = () => {
    setSignalLoading(true);
    setTimeout(() => {
      signalData.forEach(
        (datum) => (datum.Signal = Math.random() > 0.5 ? "BUY" : "SELL")
      );
      setSignalData(signalData);
      setHaveNewSignal(true);
      setSignalLoading(false);
    }, 5000);

    // const url = `${getApiUrl({ localOverride: "prod" })}/signals`;
    //   fetch(url, { method: "GET",
    //   headers: { 'X-API-Key': account?.api_key },
    //  })
    //   .then((response) => response.json())
    //   .then((data) => setSignalData(data))
    //   .then(() => setHaveNewSignal(true))
    //   .catch((err) => console.error(err))
    //   .finally(() => setSignalLoading(false));
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
        const text = data.Sig ? "BUY" : "SELL";
        const fontSize = 10;
        group.addShape("text", {
          attrs: {
            text,
            x: point.x - fontSize,
            y: point.y - fontSize / 2,
            fill,
            fontWeight: 400,
            shadowOffsetX: 10,
            shadowOffsetY: 10,
            shadowBlur: 10,
            fontSize,
          },
        });

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

        group.addShape("marker", {
          attrs: {
            x: point.x,
            y: point.y,
            r: 3,
            fill,
            opacity: 0.7,
            symbol,
          },
        });
        group.addShape("marker", {
          attrs: {
            x: point.x,
            y: point.y,
            r: 0.75,
            fill,
            symbol,
          },
        });
      }

      return group;
    },
  });
  const config = {
    autoFit: true,
    data: toggle ? previewData.BTC.data : previewData.USD.data,
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
    animation: !inBeta && {
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
        formatter: (v: any) => (toggle ? formatBTC(v) : formatUSD(v)),
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

  // const Placeholder = () => (
  //   <Col>
  //     {new Array(7).fill(
  //       <Card hoverable style={{ textAlign: "center" }}>
  //         {new Date().getHours() +
  //           ":" +
  //           new Date().getMinutes() +
  //           ":" +
  //           new Date().getSeconds()}
  //       </Card>
  //     )}
  //   </Col>
  // );
  // const Placeholder = () => {
  //   return (<Card> a </Card>)
  // }

  // use Collapse and Cards
  // OR
  // Card with onClick to Card in Modal

  // const APIKey = styled(Input.Password)`
  //   input {
  //     pointer-events: none;
  //   }

  //   .ant-input-affix-wrapper:hover,
  //   .ant-input-affix-wrapper:active {
  //     border-color: #52e5ff;
  //     box-shadow: 0 0 5px #52e5ff;
  //   }

  //   .ant-input-affix-wrapper:focus,
  //   .ant-input-affix-wrapper-focused {
  //     border-color: #52e5ff;
  //   }
  // `;

  // const StyledSwagger = styled(SwaggerUI)``;
  // .swagger-ui .opblock-description-wrapper {
  //   display: none;
  // }

  // .swagger-ui .opblock.opblock-get .opblock-summary-method {
  //   background: #52e5ff;
  // }

  // const copyToClipboard = (val: string, name: string) =>
  //   navigator.clipboard.writeText(val).then(
  //     () => message.success(`Copied ${name} to clipboard.`),
  //     () => message.error(`Did not copy ${name} to clipboard`)
  //   );

  const betaTitlePrefix = "New Signal:";
  const betaTitle = (
    <div className={styles.content}>
      <div className={styles.betaContainer}>
        <div className={styles.text}>{betaTitlePrefix}</div>
        {/* fix this actually show real signal after loading */}
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
              {haveNewSignal && width > 390 && (
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
              {haveNewSignal && width > 390 && (
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
              {haveNewSignal && width > 390 && (
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
              : "You are not in the closed beta, but you may receive an invitation in the future."
          }
          type={inBeta ? "success" : "warning"}
          showIcon
          closable
          style={{ marginBottom: "12px" }}
        />
      )}
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
                  loading={signalLoading}
                  style={{ width: "100%" }}
                  className={layoutStyles.start}
                  onClick={fetchSignals}
                >
                  Get the latest signals
                </Button>
              }
            </div>
          </div>
        ) : (
          "Leveraging AutoML to beat BTC"
        )}
        {/* use latest signal from real data after api endpoint is called */}
        {/* if consecutive buy, then label BUY/HODL with green/orange diagonal split */}
        {/* same if consecutive sell, then label SELL/HODL with red/orange diagonal split */}
        {/* have "Fetch latest signals" or "Get latest signals" button */}
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
            <Switch
              checkedChildren="BTC (₿)"
              unCheckedChildren="USD ($)"
              defaultChecked
              onChange={(checked) => setToggle(checked)}
            />
          </>
        )}
      </span>
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
        <div className={styles.parent}>
          <div className={styles.child}>
            {/* fix this condition */}
            {(inBeta && null) || (!loading && <Line {...config} />)}
          </div>
          <div style={{ height: "400px" }} className={styles.child}>
            {inBeta ? (
              <>
                <Modal
                  visible={showSignalCard}
                  closable={false}
                  onCancel={() => setShowSignalCard(false)}
                  centered
                >
                  <Card
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
                          fontFamily: "monospace",
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
                      <span style={{ fontFamily: "monospace" }}>
                        {signalCardData.Date}
                      </span>
                    </div>
                    <div>
                      <span>
                        <b>{"Asset: "}</b>
                      </span>
                      <span style={{ fontFamily: "monospace" }}>
                        {"BTC ("}
                        <span style={{ color: "#F7931A" }}>{"₿"}</span>
                        {")"}
                      </span>
                    </div>
                    {/* {`Signal: ${signalCardData.Signal}`}
                    {`Date: ${signalCardData.Date}`}
                    {"Asset: BTC (₿)"} */}
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
                    {/* <Card></Card> */}
                    {/* use Row of cards that expand to model when clicked */}
                    {signalData.map((datum, idx) => (
                      <Col key={idx} flex={1}>
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
                            // headStyle={{ background: cardHeaderColors[datum.Day] }}
                            bodyStyle={{
                              // background:
                              //   datum.Signal === "BUY" && !signalLoading
                              //     ? // ? "lime"
                              //       "#13a8a8"
                              //     : // ? "#52e5ff"
                              //     datum.Signal === "SELL" && !signalLoading
                              //     ? // ? "red"
                              //       "#cb2b83"
                              //     : // ? "magenta"
                              //       "inherit",
                              display: "flex",
                              justifyContent: "center",
                              height: "100%",
                              alignItems: "center",
                            }}
                            // title={datum.Day.toUpperCase()}
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
                              // <Spin
                              //   indicator={
                              //     <LoadingOutlined
                              //       style={{ fontSize: 25 }}
                              //       spin
                              //     />
                              //   }
                              // />
                            )}
                            {!signalLoading &&
                              (datum.Signal === "BUY" ? (
                                // ? "lime"
                                <CaretUpFilled
                                  // fill="lime"
                                  style={{
                                    fontSize: `${caretIconSize}px`,
                                    color: "lime",
                                    marginBottom: `${caretIconSize / 2}px`,
                                  }}
                                />
                              ) : // ? "#52e5ff"
                              datum.Signal === "SELL" ? (
                                // ? "red"
                                <CaretDownFilled
                                  // fill="red"
                                  style={{
                                    fontSize: `${caretIconSize}px`,
                                    color: "red",
                                    marginTop: `${caretIconSize / 2}px`,
                                  }}
                                />
                              ) : (
                                // ? "magenta"
                                <QuestionOutlined
                                  style={{ fontSize: `${caretIconSize}px` }}
                                />
                              ))}
                            {/* <Skeleton loading={signalLoading} active /> */}
                          </Card>
                        </Badge.Ribbon>
                      </Col>
                    ))}
                    {/* <Col flex={1}>
                      <span
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          height: "100%",
                        }}
                      >
                        <Button
                          loading={signalLoading}
                          className={layoutStyles.start}
                          onClick={fetchSignals}
                        >
                          Fetch the latest signals
                        </Button>
                      </span>
                    </Col> */}
                    {/* use card loading state after signals req */}
                  </Row>
                </div>
                {/* <Input.Group> */}
                {/* <span style={{ display: "flex" }}> */}
                {/* <APIKey */}
                {/* style={{ userSelect: "none" }} */}
                {/* // style={{pointerEvents: 'none'}} */}
                {/* addonBefore="API Key" */}
                {/* defaultValue={account?.api_key} */}
                {/* readOnly */}
                {/* /> */}
                {/* change input focus color to cyan */}
                {/* <Button */}
                {/* onClick={() => */}
                {/* copyToClipboard(account?.api_key, "API Key") */}
                {/* } */}
                {/* icon={<CopyOutlined />} */}
                {/* /> */}
                {/* handle copying to clipboard */}
                {/* show success or info alert for a few sec at top when Copy button is pressed */}
                {/* </span> */}
                {/* </Input.Group> */}
                {/* <SwaggerUI url="https://petstore.swagger.io/v2/swagger.json" /> */}
                {/* <SwaggerUI spec={swaggerSpec} /> */}
                {/* use signals_ui.pdf in downloads folder as guide, keep wide screen - better for mobile */}
                {/* remove params wrapper div, remove info div, rename algo to Signals API or Algo API, ,  */}
                {/* requestInterceptor => should inject api key if necessary, responseInterceptor => should reveal cards on left */}
                {/* parameterize api vs api.dev and replace string in json after importing */}
                {/* split up pages: */}
                {/* 1. cards w colors and data on home page after login */}
                {/* 2. API swagger docs on separate Page called Docs with NavLink in header */}
              </>
            ) : (
              !loading && (
                <Table
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
