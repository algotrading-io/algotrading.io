import { useState, useEffect, createContext } from "react";
import { BrowserRouter, NavLink, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Layout as AntLayout, Menu, Button, Modal, Checkbox, ConfigProvider, theme } from "antd";
import type { CheckboxChangeEvent } from "antd/es/checkbox";
import {
  Authenticator,
  AmplifyProvider,
  useAuthenticator,
  createTheme,
  defaultTheme,
} from "@aws-amplify/ui-react";
import { Amplify } from "aws-amplify";
import "@aws-amplify/ui-react/styles.css";
import BTC_ICE from "@/assets/logo.png";
import overrides from "./index.module.less";
import "./index.module.less";

import {
  getLoginLoading,
  getEnvironment,
  getHostname,
  getAccount,
  getApiUrl,
} from "@/utils";
import Docs from "@/pages/docs";
import Algorithm from "@/pages/algorithm";
import Subscription from "@/pages/subscription";
import Contact from "@/pages/contact";
import Art from "@/pages/art";
import Gym from "@/pages/gym";
import TOS, { TOSTitleText } from "@/pages/tos";
import Privacy from "@/pages/privacy";
import Home from "@/pages/home";
import Alerts from "@/pages/alerts";
import Template from "@/pages/template";
import Trade from "@/pages/trade";

const { darkAlgorithm } = theme;

let config;
const isLocal = getEnvironment() === "local";
const protocol = isLocal ? "http" : "https";
const hostname = getHostname(false);
const port = isLocal ? ":8000" : "";
let redirectUrl = `${protocol}://${hostname}${port}`;

if (isLocal) {
  config = (await import("@/aws-exports")).default;
} else {
  config = {
    aws_project_region: import.meta.env.VITE_APP_REGION,
    aws_cognito_identity_pool_id: import.meta.env.VITE_APP_IDENTITY_POOL_ID,
    aws_cognito_region: import.meta.env.VITE_APP_REGION,
    aws_user_pools_id: import.meta.env.VITE_APP_USER_POOL_ID,
    aws_user_pools_web_client_id: import.meta.env.VITE_APP_WEB_CLIENT_ID,
    oauth: {
      domain: import.meta.env.VITE_APP_OAUTH_DOMAIN,
      scope: [
        "phone",
        "email",
        "openid",
        "profile",
        "aws.cognito.signin.user.admin",
      ],
      redirectSignIn: redirectUrl,
      redirectSignOut: redirectUrl,
      responseType: "code",
    },
    federationTarget: "COGNITO_USER_POOLS",
    aws_cognito_username_attributes: ["EMAIL"],
    aws_cognito_social_providers: ["GOOGLE", "FACEBOOK", "AMAZON"],
    aws_cognito_signup_attributes: ["EMAIL", "NAME", "PICTURE"],
    aws_cognito_mfa_configuration: "OPTIONAL",
    aws_cognito_mfa_types: ["TOTP"],
    aws_cognito_password_protection_settings: {
      passwordPolicyMinLength: 8,
      passwordPolicyCharacters: [
        "REQUIRES_LOWERCASE",
        "REQUIRES_NUMBERS",
        "REQUIRES_SYMBOLS",
        "REQUIRES_UPPERCASE",
      ],
    },
    aws_cognito_verification_mechanisms: ["EMAIL"],
  };
}


const authTheme = createTheme({
  name: "dark-mode-theme",
  overrides: [
    {
      colorMode: "dark",
      tokens: {
        colors: {
          neutral: {
            // flipping the neutral palette
            10: defaultTheme.tokens.colors.neutral[100],
            20: defaultTheme.tokens.colors.neutral[90],
            40: defaultTheme.tokens.colors.neutral[80],
            80: defaultTheme.tokens.colors.neutral[40],
            90: defaultTheme.tokens.colors.neutral[20],
            100: defaultTheme.tokens.colors.neutral[10],
          },
          black: { value: "#fff" },
          white: { value: "#000" },
        },
      },
    },
  ],
});

// original: gym, art, docs, app
const pages: string[] = [
  // "get started",
  // "gym",
  // "art",
  "docs",
  "algorithm", // alternative name: research
  "subscription",
  "alerts",
  "contact"
];

// "docs" should be example of how to use library or service
// resume should be in about section
// home page should be "app"
// "art" should be hidden
// "gym" should be hidden?
// split gym, art/gallery to right side of nav

const capitalize = (s: string | any[]) => s[0].toUpperCase() + s.slice(1);

const routes = [
  {
    text: (
      <>
        <div className={overrides.home}>
          {/* consider making capital FORCEPU.SH */}
          {/* use "force" to find and replace accordingly */}
          <span className={overrides.white}>FORCE</span>
          <span>PU.SH</span>
        </div>
      </>
    ),
    to: "",
  },
].concat(pages.map((page) => ({ text: capitalize(page), to: page })));

export const headerHeight = 64;
const footerHeight = headerHeight;
// add move fast; break everything to right side of header
// add logo to forcepush div
// remove menu and menu items?
// or at least move these pieces out

export const AccountContext = createContext({});

interface LayoutProps {
  route: any;
  children: any;
}
const Layout = ({ children }: LayoutProps) => {
  const [showLogin, setShowLogin] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const { user: loggedIn, signOut } = useAuthenticator((context) => [
    context.user,
  ]);
  const [account, setAccount] = useState();
  const [accountLoading, setAccountLoading] = useState(false);
  const showModal = !loggedIn && showLogin;
  const dummy = <Authenticator className={overrides.invisible} />;
  const getAccountText = (user: string | undefined) => `signed in as ${user}`;
  const accountText = getAccountText(
    loggedIn?.attributes?.name || loggedIn?.attributes?.email
  );
  const [checked, setChecked] = useState(false);
  const [acknowledgeLoading, setAcknowledgeLoading] = useState(false);
  const [selectedMenuIdx, setSelectedMenuIdx] = useState(pages.indexOf(window.location.pathname.slice(1)) + 1);
  // filter out home link from antd's menu "selected" css stylings
  const selectedMenuItems = selectedMenuIdx ? [selectedMenuIdx.toString()] : [];

  useEffect(getLoginLoading(setLoginLoading));
  useEffect(getAccount(loggedIn, setAccount, setAccountLoading), [loggedIn]);

  const onCheck = (e: CheckboxChangeEvent) => {
    setChecked(e.target.checked);
  };

  const onAcknowledge = () => {
    setAcknowledgeLoading(true);
    const jwtToken = loggedIn?.signInUserSession?.idToken?.jwtToken;
    const url = `${getApiUrl()}/account`;
    fetch(url, {
      method: "POST",
      headers: { Authorization: jwtToken },
      body: JSON.stringify({ permissions: { read_disclaimer: true } }),
    })
      .then((response) => response.json())
      .then((data) => setAccount(data))
      .catch((err) => console.error(err))
      .finally(() => setAcknowledgeLoading(false));
  };

  const location = useLocation();
  const { pathname } = location;

  redirectUrl = `${protocol}://${hostname}${port}${pathname === '/' ? '' : pathname}`;

  config.oauth.redirectSignIn = redirectUrl;
  config.oauth.redirectSignOut = redirectUrl;

  Amplify.configure(config);

  return (
    <AntLayout style={{ height: '100%' }}>
      <AntLayout.Header
        style={{
          // this is so that header stays above toggle in fixed scrolling
          zIndex: 1000,
          width: "100%",
          position: "fixed",
          height: headerHeight,
        }}
      >
        <span style={{ display: "flex", alignItems: "center" }}>
          <img className="logo" src={BTC_ICE} width={24} height={24}></img>
          <Menu
            onClick={(item) => setSelectedMenuIdx(parseInt(item.key))}
            style={{ height: headerHeight, width: "100%" }}
            theme="dark"
            mode="horizontal"
            defaultSelectedKeys={selectedMenuItems}
            selectedKeys={selectedMenuItems}
            items={routes.map((route, idx) => ({
              className: [overrides.white, overrides.ice].join(" "),
              key: idx.toString(),
              style:
                idx === 0
                  ? {
                    backgroundColor: "transparent",
                  }
                  : {
                    display: "flex",
                    alignItems: "center",
                  },
              label: <NavLink to={route.to}>{route.text}</NavLink>
            }))}
          ></Menu>
          {dummy}
          {!loginLoading && (
            <span
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              {loggedIn && (
                <span className={overrides.account}>{accountText}</span>
              )}
              {loggedIn ? (
                <Button
                  className={overrides.signOut}
                  onClick={() => {
                    setShowLogin(false);
                    signOut();
                  }}
                >
                  Sign out
                </Button>
              ) : (
                // maybe "Get signals" or "Get started"
                <Button
                  className={overrides.start}
                  onClick={() => setShowLogin(true)}
                >
                  Get started
                </Button>
              )}
              <Modal
                // changing this would change position of modal when you alternate between Sign In and Create Account
                style={{ height: "462px" }}
                open={showModal}
                closable={false}
                centered
                onCancel={() => setShowLogin(false)}
                footer={null}
                zIndex={2000}
              >
                <AmplifyProvider theme={authTheme} colorMode="dark">
                  <Authenticator />
                </AmplifyProvider>
              </Modal>
            </span>
          )}
        </span>
      </AntLayout.Header>

      <AntLayout.Content
        style={{
          padding: 24,
          marginTop: headerHeight,
          overflow: "auto",
        }}
      >
        <Modal
          width={600}
          title={TOSTitleText(true)}
          bodyStyle={{
            height: "200px",
            padding: "24px",
            overflowY: "scroll",
            color: "rgba(255, 255, 255, 0.45)",
          }}
          open={account && !account?.permissions?.read_disclaimer}
          closable={false}
          centered
          zIndex={2000}
          footer={
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingLeft: "8px",
              }}
            >
              <Checkbox
                className={overrides.checkbox}
                checked={checked}
                onChange={onCheck}
                style={{ textAlign: "left", width: "100%" }}
              >
                {
                  <>
                    <span>{"I agree to the Terms of Service "}</span>
                    <br className={overrides.mobileBreak} />
                    <span>{"& Financial Disclaimer."}</span>
                  </>
                }
              </Checkbox>
              <Button
                className={overrides.start}
                loading={acknowledgeLoading}
                disabled={!checked}
                onClick={onAcknowledge}
              >
                OK
              </Button>
            </div>
          }
        >
          <TOS modal />
        </Modal>
        <AccountContext.Provider
          value={{ account, accountLoading, loginLoading, setShowLogin, setAccount }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/algorithm" element={<Algorithm />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/art" element={<Art />} />
            <Route path="/gym" element={<Gym />} />
            <Route path="/tos" element={<TOS />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/template" element={<Template />} />
            <Route path="/trade" element={<Trade />} />
            {/* This is 404 redirect to home page for unknown routes */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AccountContext.Provider>
      </AntLayout.Content>
      <AntLayout.Footer
        style={{
          maxHeight: footerHeight,
          height: '100%',
          display: "flex",
          justifyContent: "space-between",
          // backgroundColor: "#1f1f1f",
          alignItems: "center",
        }}
      >
        <span className={overrides.footerLink}>
          _move fast; break everything
        </span>
        <NavLink onClick={() => setSelectedMenuIdx(0)} className={overrides.footerLink} to="/tos">
          Terms of Service & Financial Disclaimer
        </NavLink>
        <NavLink onClick={() => setSelectedMenuIdx(0)} className={overrides.footerLink} to="/privacy">
          Privacy
        </NavLink>
      </AntLayout.Footer>
    </AntLayout>
  );
};

export default ({ route, children }: LayoutProps) => (
  <ConfigProvider theme={{
    algorithm: darkAlgorithm,
    token: {
      // rounded edges
      borderRadius: 2,
      // card box shadow
      boxShadowCard: "0 1px 2px -2px rgb(0 0 0 / 64%), 0 3px 6px 0 rgb(0 0 0 / 48%), 0 5px 12px 4px rgb(0 0 0 / 36%)",
      // button box shadow
      controlTmpOutline: '0 2px 0 rgb(0 0 0 / 2%)',
      // borderRadiusLG: 2,
      // borderRadiusSM: 2,
      fontFamily: 'Syne Mono, "Helvetica Neue", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
    },
    components: {
      Input: {
        // input background
        colorBgContainer: 'transparent',
      },
      Table: {
        borderRadiusLG: 4
      },
      Card: {
        borderRadiusLG: 4
      }
      // Button: {
      //   controlTmpOutline: '0 2px 0 rgb(0 0 0 / 2%)'
      // }
    },
  }}>
    <Authenticator.Provider>
      <BrowserRouter>
        <Layout route={route}>{children}</Layout>
      </BrowserRouter>
    </Authenticator.Provider>
  </ConfigProvider>
);



