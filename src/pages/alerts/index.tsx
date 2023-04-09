import React from "react";
import { useState, useEffect, useMemo, useContext } from "react";
import { useSearchParams } from "react-router-dom";
import { Typography, notification, Tooltip, Badge, Card, Button, Spin, Alert, Select, Input, Popover, Result, Switch } from "antd";
import { getApiUrl, getDayDiff, get3DCircle, linspace } from "@/utils";
import pageStyles from "@/pages/home/index.module.less";
import layoutStyles from "@/layouts/index.module.less";
import { CopyOutlined, LoadingOutlined } from "@ant-design/icons";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { AccountContext } from "../../layouts";
import CUBE from "../../../assets/cube.gif";
import { headerHeight } from "../../layouts";
import subStyles from "@/pages/subscription/index.module.less";
import overrides from "@/pages/alerts/index.module.less";
import { copyToClipboard } from "@/pages/docs";
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
// Async version has slightly higher bundle size but faster load
// import { LightAsync as SyntaxHighlighter } from 'react-syntax-highlighter';
import { xt256 } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import py from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
SyntaxHighlighter.registerLanguage('python', py);

import "./index.module.less";

import styled from "styled-components";

const { Title } = Typography;

const codeString =
  `def lambda_handler(event, context):
    signals = json.loads(event['body'])
    headers = event['headers']
    is_legit = False
    
    # grab this from forcepu.sh/docs
    my_api_key = 'this_is_a_secret'
    if headers['X-API-Key'] == my_api_key:
        is_legit = True
    
    signal = signals[0]
    
    if is_legit:
        if signal['Signal'] == 'BUY':
            # implement buying logic
            pass
        else:
            # implement selling logic
            pass

    print(json.dumps(signals, indent=4))
    # [
    #     {
    #         "Asset": "BTC",
    #         "Date": "2020-01-01",
    #         "Day": "Wed",
    #         "Signal": "BUY"
    #     }
    # ]

    return {
        'statusCode': 200,
        'body': 'OK'
    }`;

const AlertsPage = () => {
  const { user: loggedIn } = useAuthenticator((context) => [context.user]);
  const { account, setShowLogin, setAccount, accountLoading } = useContext(
    AccountContext
  );
  const [alertsLoading, setLoading] = useState(false);
  // may need useEffect to set webhook url
  const [url, setUrl] = useState(account?.alerts?.webhook || "")
  const loading = alertsLoading || accountLoading;

  const contentStyle = {
    height: `calc(100% - ${headerHeight + 1}px)`,
    // width: '100%',
    // display: 'flex',
    // flexDirection: 'column',
    // justifyContent: 'center'
  };

  // useEffect(() => {
  //   if (account) {
  //     const webhookUrl = account?.alerts?.webhook;
  //     if (webhookUrl) {
  //       setUrl(webhookUrl);
  //       setSaved(true);
  //     }
  //   }

  // }, [account])

  const postAccount = (alerts) => {
    setLoading(true);
    const jwtToken = loggedIn?.signInUserSession?.idToken?.jwtToken;
    const url = `${getApiUrl()}/account`;
    fetch(url, {
      method: "POST",
      headers: { Authorization: jwtToken },
      body: JSON.stringify(alerts),
    })
      .then((response) => response.json())
      .then((data) => setAccount(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  const onClear = () => postAccount({ alerts: { webhook: "" } });
  const onSave = () => postAccount({ alerts: { webhook: url } });

  const saveBtn =
    <Button
      // className={layoutStyles.start}
      disabled={loading}
      onClick={onSave}>
      Save
    </Button>;
  const clearBtn =
    // <>
    // <Button onClick={() => setSaved(!saved)}>Edit</Button>
    <Button disabled={loading} className={subStyles.subscribe} onClick={onClear}>Clear</Button>;
  // </>;


  return (
    <>
      <Title>Notifications</Title>
      {/* red alert if not loggedIn- exact message in keep */}
      {/* yellow alert if subscription not active or not in beta - exact message in keep */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: contentStyle.height
        // alignItems: 'center'
      }}>
        <div
          style={{
            display: 'flex',
            height: '100%'
            // flexDirection: 'column'
            // maxWidth: '600px' 
          }}
          className={overrides.alerts}
        >
          <div className={overrides.column}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: '300px' }}>
              <Title level={2} style={{ margin: 0 }}>Email</Title>
              <Switch
                checked={account?.alerts?.email}
                disabled={loading || !account}
                onChange={(e) => postAccount({ alerts: { email: e } })}
              />
            </div>
            Receive an email when a new signal is detected.
            <br />
            (For manual trading, this is the preferred notification type.)
          </div>
          <div className={overrides.column}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: '300px' }}>
              <Title level={2} style={{ margin: 0 }}>Webhook</Title>
              <Switch
                checked={account?.alerts?.webhook}
                disabled={loading || !account || !account?.alerts?.webhook}
                onChange={(e) => !e && onClear()}
              />
            </div>
            Receive a webhook event when a new signal is detected.
            <br />
            (For automated trading, this is the preferred notification type.)
            <b>Listen for events</b>
            <div style={{ display: 'flex' }}>
              <Input
                disabled={loading || account?.alerts?.webhook}
                placeholder="https://api.domain.com/route"
                onChange={(event) => setUrl(event.target.value)}
              />
              {account?.alerts?.webhook ? clearBtn : saveBtn}
            </div>
            {/* <br /> */}
            {/* <div> */}
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span><b>Sample Code</b> [Python] (AWS Lambda):</span> <Button
              onClick={() => copyToClipboard(codeString, "code")}
              icon={<CopyOutlined />}
            /></span>
            {/* add Flask code block?*/}
            {/* <div> */}
            <SyntaxHighlighter
              language="python"
              style={xt256}
              showLineNumbers
            >
              {codeString}
            </SyntaxHighlighter>
            {/* </div>
            </div> */}
          </div>
          <div className={overrides.column} style={{ color: 'rgba(255, 255, 255, 0.45)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: '300px' }}>
              <Title level={2} style={{ margin: 0, color: 'rgba(255, 255, 255, 0.45)' }}>SMS</Title>
              <Switch
                checked={account?.alerts?.sms}
                disabled={true || loading || !account}
              />
            </div>
            <Input disabled placeholder="+1 (555) 555-5555" />
            Coming soon...
          </div>
        </div>
        {/* bull image on left, bear image on right
        or bull left middle, bear left bottom (both under email in the left col), and webhook stuff in the middle col
        use monochrome / B&W images when email is disabled and colored images when email is enabled
        show toasts when alert is saved or fails
        show warning alert on top for those not in beta or not subscribed
        disable input/toggles if not signed in + tooltips + redirect to sign in model
        write sentence about how signals come in between 12:00-12:10 UTC
         */}
      </div>
    </>
  );
};

AlertsPage.displayName = "Alerts";

export default AlertsPage;
