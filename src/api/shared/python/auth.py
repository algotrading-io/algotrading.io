import os
import json
import requests
from time import time
from jose import jwk, jwt
from jose.utils import base64url_decode

if os.environ.get('TEST') != 'true':
    region = os.environ['REGION']
    user_pool_id = os.environ['USER_POOL_ID']
    web_client_id = os.environ['WEB_CLIENT_ID']
    keys_url = f'https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json'
    keys = requests.get(keys_url).json()['keys']


def verify_token(event):
    token = json.loads(event['body'])['token']
    # get the kid from the headers prior to verification
    headers = jwt.get_unverified_headers(token)
    kid = headers['kid']
    # search for the kid in the downloaded public keys
    key_index = -1
    for i in range(len(keys)):
        if kid == keys[i]['kid']:
            key_index = i
            break
    if key_index == -1:
        print('Public key not found in jwks.json')
        return False
    # construct the public key
    public_key = jwk.construct(keys[key_index])
    # get the last two sections of the token,
    # message and signature (encoded in base64)
    message, encoded_signature = str(token).rsplit('.', 1)
    # decode the signature
    decoded_signature = base64url_decode(encoded_signature.encode('utf-8'))
    # verify the signature
    if not public_key.verify(message.encode("utf8"), decoded_signature):
        print('Signature verification failed')
        return False
    print('Signature successfully verified')
    # since we passed the verification, we can now safely
    # use the unverified claims
    claims = jwt.get_unverified_claims(token)
    # additionally we can verify the token expiration
    if time() > claims['exp']:
        print('Token is expired')
        return False
    # and the Audience  (use claims['client_id'] if verifying an access token)
    if claims['aud'] != web_client_id:
        print('Token was not issued for this audience')
        return False
    # now we can use the claims
    return claims
