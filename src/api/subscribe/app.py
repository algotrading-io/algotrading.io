import os
import json
import stripe
import logging
from models import UserModel
from datetime import datetime, timedelta, timezone
from pynamodb.attributes import UTCDateTimeAttribute
from utils import \
    verify_user, options, \
    error, enough_time_has_passed, \
    PAST_DATE, RES_HEADERS, TEST

stripe.api_key = os.environ['STRIPE_SECRET_KEY']


def get_price(price_id):
    price = stripe.Price.retrieve(price_id)
    status_code = 200
    body = json.dumps(price)
    return {
        "statusCode": status_code,
        "body": body,
        "headers": RES_HEADERS
    }


def get_plans(*_):
    price_id = os.environ['STRIPE_PRICE_ID']
    # ideally create price table with priceId, amount as float or str, intervalCount, and interval
    # only make stripe call if priceId not in table, then update table
    # else fetch price from table

    # return { BTC: monthly: price: res from get_price }
    return get_price(price_id)


def get_product(event, _):
    params = event["queryStringParameters"]
    product_id = params["id"]
    product = stripe.Product.retrieve(product_id)
    status_code = 200
    body = json.dumps(product)
    return {
        "statusCode": status_code,
        "body": body,
        "headers": RES_HEADERS
    }


def handle_checkout(event, _):
    if event['httpMethod'].upper() == 'OPTIONS':
        response = options()
    else:
        response = post_checkout(event)

    return response


def post_checkout(event):
    # TODO: IMPLEMENT FRAUD DETECTION for Checkout
    # e.g. require full billing address, CVC, ??
    # https://stripe.com/docs/radar/integration#recommendations

    # TODO: figure out 3DS Secure 2 and Chargeback Protection
    verified = verify_user(event)

    if not verified:
        return error(401, 'This account is not verified.')

    price_id = os.environ['STRIPE_PRICE_ID']
    env = os.environ['STAGE']
    email = verified['email']
    req_headers = event['headers']
    origin = req_headers.get(
        'origin') or f"https://{'dev.' if env == 'dev' else ''}forcepu.sh"

    # Get customerId from user.stripe {} obj
    user = UserModel.get(email)
    stripe_lookup = user.stripe
    customer_id = user.customer_id

    if customer_id and customer_id != '_':
        # check if user has active subscription to product
        # if so, throw error saying already subscribed
        # customer = stripe.Customer.retrieve(
        #     customer_id, expand=['subscriptions']
        # )
        if user.subscribed:
            return error(400, 'User is already subscribed.')
            # use product_id or name that is passed in
            # don't take price_id from req, use from backend (make get /subscribe endpoint w all prices, products)
            # e.g. { BTC: productId: xxx, priceId: yyy }
            # should this be a table created and updated on deploy?
            # prices table - priceId, cost, interval_count, interval
            # or create table thru template.yaml and on first GET /price for a given priceId,
            # pull from stripe if doesn't exist in db, else pull script from db
            # webhooks for price changes ? updates/deletions/creations

            # create checkout session table
            # That way, api can return existing session instead of creating new one.
            # Unexpire session? - but would have to manage prices make sure current priceid
    else:
        name = verified['name']
        customer = stripe.Customer.create(email=email, name=name)
        customer_id = customer['id']
        user.update(actions=[UserModel.customer_id.set(customer_id)])

    checkout = stripe_lookup.checkout
    duration_days = 1
    reset_duration = timedelta(days=duration_days)
    start = checkout['created']
    if type(start) == str:
        start = UTCDateTimeAttribute().deserialize(start)
    now = datetime.now(timezone.utc)
    # check stripe_lookup.checkout.created
    # if (current time in UTC - created) delta > 1 day delta:
    if enough_time_has_passed(start, now, reset_duration):
        # then create new session, save session created time in UTC, save url, serve session.url
        # else, serve checkout url

        # use customerId in checkout session create call below
        session = stripe.checkout.Session.create(
            customer=customer_id,
            customer_update={'address': 'auto', 'name': 'auto'},
            # use url (domain/subscription) from req.origin?
            success_url=f'{origin}/subscription?success=true&session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{origin}/subscription?canceled=true',
            mode='subscription',
            line_items=[{
                'price': price_id,
                # For metered billing, do not pass quantity
                'quantity': 1
            }],
            automatic_tax={
                'enabled': True
            },
            # specify terms of service agreement?
            # consent_collection.terms_of_service
        )
        checkout['created'] = UTCDateTimeAttribute().serialize(now)
        checkout['url'] = session.url
        stripe_lookup.checkout = checkout
        user.update(actions=[UserModel.stripe.set(stripe_lookup)])

    url = checkout['url']
    status_code = 200
    body = json.dumps(url)

    return {
        "statusCode": status_code,
        "body": body,
        "headers": RES_HEADERS
    }


def handle_billing(event, _):
    if event['httpMethod'].upper() == 'OPTIONS':
        response = options()
    else:
        response = post_billing(event)

    return response


def post_billing(event):
    # create customer portal session
    # (where customer can cancel, change payment method, see payment history, etc)

    verified = verify_user(event)

    if not verified:
        return error(401, 'This account is not verified.')

    env = os.environ['STAGE']
    email = verified['email']
    req_headers = event['headers']
    origin = req_headers.get(
        'origin') or f"https://{'dev.' if env == 'dev' else ''}forcepu.sh"

    # Get customerId from user.stripe {} obj
    user = UserModel.get(email)
    customer_id = user.customer_id
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f'{origin}/subscription',
    )

    url = session.url
    status_code = 200
    body = json.dumps(url)

    return {
        "statusCode": status_code,
        "body": body,
        "headers": RES_HEADERS
    }


def post_subscribe(event, _):
    # signing key for specific endpoint in Stripe Dashboard
    # not the same as CLI secret
    if TEST:
        event = json.loads(event['body'])
    else:
        webhook_secret = os.environ['STRIPE_WEBHOOK_SECRET']
        req_body = event['body']
        req_headers = event['headers']
        signature = req_headers['Stripe-Signature']
        try:
            event = stripe.Webhook.construct_event(
                req_body, signature, webhook_secret)
        except ValueError as e:
            # Invalid payload
            logging.exception(e)
            raise e
        except stripe.error.SignatureVerificationError as e:
            # Invalid signature
            logging.exception(e)
            raise e

    body = json.dumps({'status': 'success'})
    response = {
        "statusCode": 200,
        "body": body,
        "headers": RES_HEADERS
    }
    # ONLY events approved in Stripe Dashboard Settings > Webhooks
    # will come through
    event_type = event['type']
    subscription_events = set([
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'customer.subscription.paused',
        'customer.subscription.resumed',
    ])

    if event_type in subscription_events:
        sub = event['data']['object']
        customer_id = sub['customer']
        user = list(UserModel.customer_id_index.query(customer_id))[0]
        # due to a race condition,
        # incomplete subscription.created events can be sent by stripe AFTER active subscription.updated events
        # in this case, we should not update the db
        if event_type == 'customer.subscription.created' and sub['status'] == 'incomplete':
            return response
        sub_is_active = sub['status'] == 'active'
        stripe_lookup = user.stripe
        sub_was_active = bool(user.subscribed)

        if sub_was_active != sub_is_active:
            actions = [UserModel.subscribed.set(int(sub_is_active))]
            if not sub_is_active:
                stripe_lookup.checkout['created'] = UTCDateTimeAttribute(
                ).serialize(PAST_DATE)
                actions.append(UserModel.stripe.set(stripe_lookup))
            user.update(actions=actions)

    return response
