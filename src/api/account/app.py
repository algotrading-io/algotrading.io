import os
import re
import json
import stripe
from models import UserModel, ATTRS_LOOKUP, ALERTS_LOOKUP
from utils import options, verify_user

stripe.api_key = os.environ['STRIPE_SECRET_KEY']


def handle_account(event, _):
    if event['httpMethod'].upper() == 'OPTIONS':
        response = options()
    elif event['httpMethod'].upper() == 'POST':
        response = post_account(event)
    elif event['httpMethod'].upper() == 'DELETE':
        response = delete_account(event)
    else:
        response = get_account(event)

    return response


def get_account(event):
    verified = verify_user(event)

    status_code = 401
    body = json.dumps({'message': 'This account is not verified.'})

    if verified:
        status_code = 200
        email = verified['email']
        try:
            user = UserModel.get(email)
        except UserModel.DoesNotExist:
            user = UserModel(email)
            user.save()
        body = user.to_json()

    return {
        "statusCode": status_code,
        "body": body,
        "headers": {"Access-Control-Allow-Origin": "*"}
    }


def post_account(event):
    verified = verify_user(event)

    status_code = 401
    body = json.dumps({'message': 'This account is not verified.'})

    if verified:
        status_code = 200
        email = verified['email']
        user = UserModel.get(email)
        req_body = json.loads(event['body'])
        actions = []
        if (
            'permissions' in req_body
            and 'read_disclaimer' in req_body['permissions']
                and req_body['permissions']['read_disclaimer']):
            user.permissions.read_disclaimer = True
            actions.append(UserModel.permissions.set(user.permissions))

        if 'alerts' in req_body:
            alerts = json.loads(user.to_json())['alerts']
            updated_alerts = req_body['alerts']
            for key, val in updated_alerts.items():
                if key in ALERTS_LOOKUP:
                    # type(getattr(Alerts, 'sms')) == BooleanAttribute
                    expected_attr = ALERTS_LOOKUP[key]['attr']
                    expected_type = ATTRS_LOOKUP[expected_attr]
                    if type(val) == expected_type:
                        alerts[key] = val
            user.alerts = alerts
            actions.append(UserModel.alerts.set(user.alerts))

        if 'in_beta' in req_body:
            in_beta = int(req_body['in_beta'])
            pattern = r'^.*@(dev\.)?forcepu\.sh$'
            if re.match(pattern, email):
                actions.append(UserModel.in_beta.set(in_beta))

        if actions:
            user.update(actions=actions)
        body = user.to_json()

    return {
        "statusCode": status_code,
        "body": body,
        "headers": {"Access-Control-Allow-Origin": "*"}
    }


def delete_account(event):
    claims = event['requestContext']['authorizer']['claims']
    email = claims['email']
    user = UserModel.get(email)
    customer_id = user.customer_id
    if customer_id and customer_id != '_':
        # deleting a customer automatically cancels subscriptions
        stripe.Customer.delete(customer_id)
    user.delete()

    return {
        "statusCode": 200,
        "body": 'OK',
        "headers": {"Access-Control-Allow-Origin": "*"}
    }
