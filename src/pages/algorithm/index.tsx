import { useState, useEffect, useMemo } from "react";
import { Typography, Row, Col, Card, Statistic, Spin } from "antd";
import Plotly from "plotly.js-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";
import { getApiUrl, getDayDiff, get3DCircle, Toggle } from "@/utils";
import pageStyles from "../home/index.module.less";
import { LoadingOutlined } from "@ant-design/icons";
import overrides from "./index.module.less";
import "./index.module.less";

const Plot = createPlotlyComponent(Plotly);
const { Title } = Typography;

const numPoints = 360;
const eyes = get3DCircle(
  [0, 0, 0],
  [1.25, 1.25, 1.25],
  [1.25, 1.25, -1.25],
  numPoints
);
const antIcon = <LoadingOutlined style={{ fontSize: 50 }} spin />;
const spinner = <Spin style={{ width: "100%" }} indicator={antIcon} />;

const AlgorithmPage = () => {
  const [viz2D, setViz2D] = useState();
  const [viz3D, setViz3D] = useState();
  const default2DToggle = false;
  const [toggle2D, setToggle2D] = useState(default2DToggle);
  const [metadata, setMetadata] = useState([]);
  // const loading = !(metadata.length && viz2D && viz3D);
  const size = 0.4999;
  const [eyeIdx, setEyeIdx] = useState(0);
  const [up, setUp] = useState({ x: 0, y: 0, z: 1 });
  // const size = 0.3333;
  const width = 3;
  const numTicks = Math.ceil(1 / size);
  const tickText = Array(numTicks).fill("");
  tickText[0] = "SELL";
  tickText[numTicks - 1] = "BUY";
  tickText[Math.floor(numTicks / 2)] = "HODL";
  const tickVals = tickText.map((_, idx) => size * idx);
  useEffect(() => {
    const url = `${getApiUrl({ localOverride: "prod" })}/model`;
    fetch(url, { method: "GET" })
      .then((response) => response.json())
      .then((data) => {
        const {
          created,
          start,
          end,
          num_features: numFeatures,
          accuracy,
        } = data;
        const monthsAgo = Math.floor(getDayDiff(created, new Date()) / 30);
        const lastUpdated = `${monthsAgo} month${monthsAgo == 1 ? '' : 's'} ago`;
        const dataRange = `${Math.floor(getDayDiff(start, end) / 365)} years`;
        const labels = [
          "Last Updated",
          "Training Data Range",
          "Number of Features",
          "Test Accuracy",
        ];
        const values = [
          lastUpdated,
          dataRange,
          numFeatures,
          `${Math.round(accuracy * 1000) / 10}%`,
        ];
        const newData = labels.map((label, idx) => ({
          key: idx,
          metadata: label,
          stat: values[idx],
        }));
        return newData;
      })
      .then((data) => setMetadata(data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    const url = `${getApiUrl({ localOverride: "prod" })}/visualization`;
    fetch(url, { method: "GET" })
      .then((response) => response.json())
      .then((data) => setViz2D(data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    const url = `${getApiUrl({ localOverride: "prod" })}/visualization?dims=3D`;
    fetch(url, { method: "GET" })
      .then((response) => response.json())
      .then((data) => setViz3D(data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    // use frames and useMemo instead
    // https://codesandbox.io/s/pier-stat-flood-w1ed4?file=/src/Flood.js

    const interval = setInterval(() => {
      const newEyeIdx = (eyeIdx + 1) % eyes.length;
      const multiplier = numPoints / 360;
      const theta = Math.floor(newEyeIdx / multiplier);

      const roundAngle = (angle: number) => {
        // works with numPoints <= 360
        const divisor = Math.floor(360 / numPoints);
        const remainder = angle % divisor;
        return angle + (remainder ? divisor - (angle % divisor) : 0);
      };

      if (theta === roundAngle(55)) {
        setUp({ x: -1, y: -1, z: -1 });
      } else if (theta === roundAngle(180)) {
        setUp({ x: 1, y: 1, z: -1 });
      } else if (theta === 290) {
        setUp({ x: -1, y: -1, z: 1 });
      }

      setEyeIdx(newEyeIdx);

      // 15 ms => 60fps
      // 30 ms => 30fps
      // 40 ms => 24fps
    }, 15);
    return () => {
      clearInterval(interval);
    };
  }, [eyeIdx]);

  // consider making camera move in python and exporting as html
  const plot2D = useMemo(
    () => (
      <Plot
        data={[
          {
            x: viz2D?.grid[0],
            y: viz2D?.grid[1],
            z: viz2D?.preds,
            type: "contour",
            hoverinfo: "none",
            contours: {
              coloring: "fill",
              start: 0,
              end: 1,
              size: size,
            },
            line: { smoothing: 0, width },
            colorscale: [
              ["0", "magenta"],
              ["0.4", "magenta"],
              ["0.5", "#8080FF"],
              ["0.6", "cyan"],
              ["1", "cyan"],
            ],
            opacity: 0.2,
            showscale: false,
            name: "predicted",
          },
          {
            x: viz2D?.grid[0],
            y: viz2D?.grid[1],
            z: viz2D?.preds,
            type: "contour",
            hoverinfo: "none",
            contours: {
              coloring: "lines",
              start: 0,
              end: 1,
              size: size,
            },
            line: { smoothing: 0, width },
            colorscale: [
              ["0", "magenta"],
              ["1", "cyan"],
            ],
            // showscale: false,
            colorbar: {
              title: "Predicted",
              tickmode: "array",
              ticktext: tickText,
              tickvals: tickVals,
            },
            name: "predicted",
          },
          {
            x: viz2D?.actual[0]?.BUY,
            y: viz2D?.actual[1]?.BUY,
            type: "scatter",
            mode: "markers",
            // change marker outline to white after making bg black/transparent?
            marker: { color: "cyan", line: { color: "black", width: 1 } },
            showlegend: true,
            text: "BUY [actual]",
            name: "BUY",
          },
          {
            x: viz2D?.actual[0]?.SELL,
            y: viz2D?.actual[1]?.SELL,
            type: "scatter",
            mode: "markers",
            // change marker outline to white after making bg black/transparent?
            marker: {
              color: "magenta",
              line: { color: "black", width: 1 },
            },
            showlegend: true,
            text: "SELL [actual]",
            name: "SELL",
          },
        ]}
        layout={{
          font: {
            color: "rgba(255, 255, 255, 0.85)",
            // family:
            //   "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;",
            family: "inherit",
          },
          autosize: true,
          // make responsive
          // https://codesandbox.io/s/nostalgic-jones-4kuww
          title: { text: "Decision Space [2D]" },
          xaxis: { title: "x" },
          yaxis: { title: "y" },
          zaxis: { title: "z" },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          dragmode: false,
          legend: {
            y: 0,
            x: 0,
            title: { text: "Actual" },
          },
        }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
        config={{ displayModeBar: false }}
      />
    ),
    [viz2D]
  );

  const plot3D = useMemo(
    () => (
      <Plot
        data={[
          {
            x: viz3D?.actual[0]?.BUY,
            y: viz3D?.actual[1]?.BUY,
            z: viz3D?.actual[2]?.BUY,
            type: "scatter3d",
            mode: "markers",
            // change marker outline to white after making bg black/transparent?
            marker: { color: "cyan", line: { color: "black", width: 1 } },
            showlegend: true,
            text: "BUY [actual]",
            name: "BUY",
          },
          {
            x: viz3D?.actual[0]?.SELL,
            y: viz3D?.actual[1]?.SELL,
            z: viz3D?.actual[2]?.SELL,
            type: "scatter3d",
            mode: "markers",
            // change marker outline to white after making bg black/transparent?
            marker: {
              color: "magenta",
              line: { color: "black", width: 1 },
            },
            showlegend: true,
            text: "SELL [actual]",
            name: "SELL",
          },
          {
            x: viz3D?.grid[0],
            y: viz3D?.grid[1],
            z: viz3D?.grid[2],
            type: "volume",
            opacity: 0.4,
            value: viz3D?.preds,
            colorscale: [
              ["0", "magenta"],
              ["1", "cyan"],
            ],
            colorbar: {
              title: "Predicted",
              tickmode: "array",
              ticktext: tickText,
              tickvals: tickVals,
            },
            hoverinfo: "skip",
            // change marker outline to white after making bg black/transparent?
            // marker: {
            //   color: "magenta",
            //   line: { color: "black", width: 1 },
            // },
            // showlegend: true,
          },
        ]}
        // disable x, y, z titles?
        layout={{
          scene: {
            xaxis: {
              title: {
                text: "x",
                font: {
                  // size: "100",
                },
              },
              showticklabels: false,
            },
            yaxis: {
              showticklabels: false,
              title: {
                text: "y",
                font: {
                  // size: "100",
                },
              },
            },
            zaxis: {
              title: {
                text: "z",
                font: {
                  // size: "100",
                },
              },
              showticklabels: false,
            },
            camera: {
              eye: eyes[eyeIdx],
              up,
            },
          },
          font: {
            color: "rgba(255, 255, 255, 0.85)",
            // family:
            //   "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;",
            family: "inherit",
          },
          autosize: true,
          // make responsive
          // https://codesandbox.io/s/nostalgic-jones-4kuww
          title: { text: "Decision Space [3D]" },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          legend: {
            y: 0,
            x: 0,
            title: { text: "Actual" },
          },
        }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
        config={{ displayModeBar: false }}
      />
    ),
    [viz3D, eyeIdx, up]
  );

  return (
    <>
      {/* consider changing page and nav to /research and title to Algorithm */}
      {/* remove numbers on axis for 3d / camera should spin up and down */}
      {/* consider switching BTC toggle to Segmented on home screen */}
      {/* consider using Statistic component for metadata */}
      {/*  */}
      <Title>AI / ML Model</Title>
      {/* Crystal ball ...er cube */}
      <span
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "-12px 0px 12px 0px",
        }}
      >
        <Title level={5} style={{ width: "75%" }}>
          the crystal ball (or rather cube) behind our signals
        </Title>
        {/* the crystal ball ...er cube behind our signals */}
        {/* consider square and cube icons https://ant.design/components/segmented/#components-segmented-demo-with-icon */}

        <Toggle
          val={toggle2D}
          options={["2D", "3D"]}
          defaultValue={default2DToggle ? "2D" : "3D"}
          onChange={(val: string) => setToggle2D(val === "2D")}
        />
      </span>
      <div
        className={`${pageStyles.parent} ${overrides.fullHeight}`}
        style={{ alignItems: "center", minHeight: "450px" }}
      >
        <div className={pageStyles.child}>
          {!(viz2D && viz3D) ? (
            spinner
          ) : (
            <div style={{ height: '100%' }}>
              {toggle2D && plot2D}
              <div style={toggle2D ? { display: "none" } : { height: '100%' }}>{plot3D}</div>
            </div>
          )}
        </div>
        {metadata.length ? (
          <div className={pageStyles.child}>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Row gutter={[24, 24]} style={{ height: 'unset' }}>
                <Col span={24} style={{ textAlign: "justify" }}>
                  The points on the plot represent historical market data reduced
                  from {metadata[2]?.stat} dimensions to {toggle2D ? "2D" : "3D"}.
                  The filled regions represent the model's predictions. Based on
                  which region today's data point occupies, we may be able to
                  predict whether now is a good time to{" "}
                  <b>
                    <span style={{ color: "#52e5ff" }}>BUY</span>
                  </b>{" "}
                  or{" "}
                  <b>
                    <span style={{ color: "magenta" }}>SELL</span>
                  </b>
                  .
                </Col>
                {metadata?.map((datum) => (
                  <Col span={12}>
                    <Card>
                      <Statistic title={datum.metadata} value={datum.stat} />
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
};

AlgorithmPage.displayName = "Algorithm";

export default AlgorithmPage;
