const AUTH0_DOMAIN = process.env.REACT_APP_AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.REACT_APP_AUTH0_CLIENT_ID;
const AUTH0_REDIRECT_URI = process.env.REACT_APP_AUTH0_REDIRECT_URI;

export const loginWithAuth0 = () => {
  const url =
    `https://${AUTH0_DOMAIN}/authorize?` +
    `response_type=token&` +
    `client_id=${AUTH0_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(AUTH0_REDIRECT_URI)}&` +
    `scope=openid profile email`;

  window.location.href = url;
};

export const loginWithGoogle = () => {
  const url =
    `https://${AUTH0_DOMAIN}/authorize?` +
    `response_type=token&` +
    `client_id=${AUTH0_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(AUTH0_REDIRECT_URI)}&` +
    `scope=openid profile email&` +
    `connection=google-oauth2`;

  window.location.href = url;
};

export const loginWithFacebook = () => {
  const url =
    `https://${AUTH0_DOMAIN}/authorize?` +
    `response_type=token&` +
    `client_id=${AUTH0_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(AUTH0_REDIRECT_URI)}&` +
    `scope=openid profile email&` +
    `connection=facebook`;

  window.location.href = url;
};