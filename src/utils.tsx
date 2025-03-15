import { Segmented } from "antd";
import styled from "styled-components";

export const getEnvironment = () => {
  const hostname = window.location.hostname;
  switch (hostname) {
    case "localhost":
      return "local";
    case "dev.forcepu.sh":
      return "dev";
    default:
      return "prod";
  }
};

export const getHostname = (env: string | boolean) => {
  switch (env) {
    case "local":
      return "localhost";
    case "dev":
      return "dev.forcepu.sh";
    case "prod":
      return "forcepu.sh";
    default:
      return window.location.hostname;
  }
};

export const getApiUrl = ({ localOverride } = { localOverride: "" }) => {
  const isLocal = getEnvironment() === "local";
  const useLocal = isLocal && !localOverride;
  const hostname = getHostname(isLocal && localOverride);
  const url = useLocal ? "/api" : `https://api.${hostname}`;
  return url;
};

export const getDateRange = (
  start: string | Date,
  end: string | number | Date,
  steps = 1
) => {
  const range = [];
  let curr = new Date(start);

  if (typeof end === "number") {
    const tmp = new Date(start);
    tmp.setUTCDate(tmp.getUTCDate() + end);
    end = tmp;
  }

  while (curr <= new Date(end)) {
    range.push(new Date(curr));
    // Use UTC date to prevent problems with time zones and DST
    curr.setUTCDate(curr.getUTCDate() + steps);
  }

  return range;
};

const _MS_PER_DAY = 1000 * 60 * 60 * 24;

export const getDayDiff = (start: string | Date, end: string | Date) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startUTC = Date.UTC(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const endUTC = Date.UTC(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  const diff = Math.floor((endUTC - startUTC) / _MS_PER_DAY);
  return diff;
};

export const addDays = (date: string | Date, steps = 0) => {
  const newDate = new Date(date);
  newDate.setUTCDate(newDate.getUTCDate() + steps);
  return newDate;
};

export const convertShortISO = (dateString: string) => {
  const year = dateString.slice(0, 4);
  const month = dateString.slice(5, 7);
  const day = dateString.slice(8, 10);
  return `${month}/${day}/${year}`;
};

export const getLoginLoading = (setLoginLoading: any) => () => {
  setLoginLoading(window.location?.search?.indexOf("?code=") === 0);
};

export const getAccount = (
  loggedIn: any,
  setAccount: any,
  setAccountLoading: any
) => () => {
  if (loggedIn) {
    setAccountLoading(true);
    const jwtToken = loggedIn?.signInUserSession?.idToken?.jwtToken;
    const url = `${getApiUrl()}/account`;
    fetch(url, {
      method: "GET",
      headers: { Authorization: jwtToken },
    })
      .then((response) => response.json())
      .then((data) => setAccount(data))
      .catch((err) => console.error(err))
      .finally(() => setAccountLoading(false));
  }
};

// https://stackoverflow.com/questions/17428587/transposing-a-2d-array-in-javascript
export const transpose = (matrix: any[][]) =>
  matrix[0].map((_, i) => matrix.map((row) => row[i]));

// dot product
const dot = (v1: number[], v2: number[]) =>
  v1.reduce((sum, val, idx) => sum + val * v2[idx], 0);

// cross product
const cross = (v1: number[], v2: number[]) =>
  Array(3)
    .fill(0)
    .map(
      (_, idx) =>
        v1[(idx + 1) % 3] * v2[(idx + 2) % 3] -
        v1[(idx + 2) % 3] * v2[(idx + 1) % 3]
    );

// add
const add = (v1: number[], v2: number[]) => v1.map((val, idx) => val + v2[idx]);

// subtract
const subtract = (v1: number[], v2: number[]) =>
  v1.map((val, idx) => val - v2[idx]);

// divide
const divide = (v1: number[], divisor: number) =>
  v1.map((val) => val / divisor);

const findPlane = (pt1: number[], pt2: number[], pt3: number[]) => {
  const u = subtract(pt2, pt1);
  const v = subtract(pt3, pt1);

  const normal = cross(u, v);
  const [a, b, c] = normal;
  const point = pt1.map((x: number) => -x);
  const d = dot(point, normal);
  return [a, b, c, d];
};

// distance
const dist = (pt1: number[], pt2: number[]) =>
  Math.sqrt(pt1.reduce((sum, val, idx) => sum + (val - pt2[idx]) ** 2, 0));

// norm
const norm = (v1: number[]) => dist(v1, Array(v1.length).fill(0));

// linspace
export const linspace = (
  start: number,
  end: number,
  numPoints: number,
  includeEndpoint = true
) =>
  Array(numPoints)
    .fill(0)
    .map(
      (_, idx) =>
        start +
        idx *
        ((end - (includeEndpoint ? 0 : end / numPoints) - start) /
          (numPoints - 1))
    );

// https://math.stackexchange.com/a/73242
export const get3DCircle = (
  center: number[],
  pt1: number[],
  pt2: number[],
  refinement = 360
) => {
  const plane = findPlane(center, pt1, pt2);
  const normal = plane.slice(0, 3);
  const unitNormal = divide(normal, norm(normal));

  let q1 = divide(pt1, norm(pt1));
  let q2 = add(center, cross(q1, unitNormal));
  // 0 -> 360 degrees in radians
  const angles = linspace(0, 2 * Math.PI, refinement, false);

  const radius = dist(center, pt1);

  q1 = divide(q1, norm(q1));
  q2 = add(center, cross(q1, unitNormal));

  const convertToXYZ = (theta: number, idx: number) =>
    center[idx] +
    radius * Math.cos(theta) * q1[idx] +
    radius * Math.sin(theta) * q2[idx];

  const circle = angles.map((theta) =>
    ["x", "y", "z"].reduce(
      (point, axis, dim) => ({ ...point, [axis]: convertToXYZ(theta, dim) }),
      {}
    )
  );
  return circle;
};

export const signalColors = {
  BUY: "lime",
  SELL: "red",
  HODL: "#F7931A",
};

export const signalEmojis = {
  BUY: "🚀",
  SELL: "💥",
};

const toggleGray = 'rgba(255, 255, 255, 0.3)';

export const Toggle = styled(Segmented)`

  .ant-segmented-item-selected {
    background-color: ${(props: { var: string, val: boolean }) => (props.var == 'home' ? (props.val ? '#F7931A' : toggleGray) : 'unset')};
    outline: ${(props: { var: string, val: boolean }) => (props.var === 'home' ? "unset" : "1px solid " + (props.val ? "#52e5ff" : "magenta"))};
    color: rgba(255, 255, 255, 0.85);
  }

  .ant-segmented-item:hover,
  .ant-segmented-item:focus {
    color: rgba(255, 255, 255, 0.85);
  }

  .ant-segmented-thumb {
    background-color: ${(props: { var: string, val: boolean }) => (props.var === 'home' ? 'transparent' : (props.val ? "magenta" : "#52e5ff"))};
    border-width: ${(props: { var: string, val: boolean }) => (props.var === 'home' ? '1px' : 'unset')};
    border-style: ${(props: { var: string, val: boolean }) => (props.var === 'home' ? 'solid' : 'unset')};
    border-left-color: ${(props: { var: string, val: boolean }) => (props.var === 'home' ? (props.val ? toggleGray : "#F7931A") : 'unset')};
    border-top-color: ${(props: { var: string, val: boolean }) => (props.var === 'home' ? (props.val ? toggleGray : "#F7931A") : 'unset')};
    border-right-color: ${(props: { var: string, val: boolean }) => (props.var === 'home' ? (props.val ? toggleGray : "#F7931A") : 'unset')};
    border-bottom-color: ${(props: { var: string, val: boolean }) => (props.var === 'home' ? (props.val ? toggleGray : "#F7931A") : 'unset')};
  }
`;

export const isEmpty = (obj: Object) => !(obj && Object.keys(obj).length)