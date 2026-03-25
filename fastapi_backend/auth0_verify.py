from fastapi import Header, HTTPException
from jose import jwt


def decode_auth0_token(token: str):
    try:
        return jwt.get_unverified_claims(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid Auth0 token") from exc


def verify_auth0_token(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.split(" ")[1]
    return decode_auth0_token(token)
