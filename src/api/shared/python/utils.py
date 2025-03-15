import os
import json
from datetime import datetime, timezone

RES_HEADERS = {"Access-Control-Allow-Origin": "*"}

PAST_DATE = datetime(2020, 1, 1, tzinfo=timezone.utc)
DATE_FMT = '%Y-%m-%d'


def str_to_bool(s):
    return s.lower() == 'true'


TEST = str_to_bool(str(os.environ.get('TEST')))


def get_email(user, env):
    return f"{user}@{'dev.' if env == 'dev' else ''}forcepu.sh"


def transform_signal(raw_signal):
    signal = {}
    date = raw_signal['Time']
    if type(date) == list:
        date = date[0]

    sig = raw_signal['Sig']
    if type(sig) == list:
        sig = sig[0]
    if type(sig) == str:
        sig = str_to_bool(sig)
    sig = 'BUY' if sig else 'SELL'

    signal['Date'] = date
    signal['Signal'] = sig
    signal['Day'] = datetime.strptime(date, DATE_FMT).strftime('%A')[:3]
    signal['Asset'] = 'BTC'
    return signal


def enough_time_has_passed(start, end, delta):
    return end - start >= delta


def error(status, message):
    return {
        "statusCode": status,
        "body": json.dumps(
            {'message': message}
        ),
        "headers": RES_HEADERS
    }


def options():
    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS,POST,PUT,DELETE",
            "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key"
        }
    }


def verify_user(event):
    claims = (
        event['requestContext']['authorizer']['claims']
        if 'requestContext' in event else event
    )
    # email_verified value comes back as str, so explicitly casting as str
    # in case it comes back as bool in the future
    verified = str_to_bool(str(claims['email_verified']))
    # ['email']
    # ['email_verified']
    # ['name']
    providers = ['Google', 'Facebook', 'LoginWithAmazon']
    if not verified:
        if 'identities' in claims:
            identities = json.loads(claims['identities'])
            # => ['providerName'] == 'Google'
            # => ['providerType'] == 'Google'
            if 'providerName' in identities:
                if identities['providerName'] in providers:
                    verified = True
    return verified and claims
