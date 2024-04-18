import os
import re
import json
import boto3
import pyotp
from time import sleep
from pathlib import Path
from random import random
from math import log, sqrt, ceil, floor
from statistics import NormalDist
from collections import defaultdict
import robin_stocks.robinhood as rh
from datetime import datetime, timedelta
from botocore.exceptions import ClientError
if str(os.environ.get("LOCAL")).lower() == "true":
    from src.api.shared.python.utils import (
        verify_user, options, error, str_to_bool)
    from src.api.shared.python.auth import verify_token
else:
    from utils import \
        verify_user, options, error, str_to_bool
    from auth import verify_token

s3 = boto3.resource('s3')


def calc_d1(stock_price, strike_price, implied_vol, rho, div_yield, time):
    numerator = log(stock_price / strike_price) + \
        (rho - div_yield + (implied_vol ** 2) / 2) * time
    denominator = implied_vol * sqrt(time)
    return numerator / denominator


def calc_d2(d1, implied_vol, time):
    return d1 - implied_vol * sqrt(time)


def chance_of_profit(**kwargs):
    # rh assumes div_yield is zero when calculating this
    d1 = calc_d1(**kwargs)
    d2 = calc_d2(d1, kwargs['implied_vol'], kwargs['time'])
    return 1 - NormalDist().cdf(d2)


def handle_trade(event, _):
    if event['httpMethod'].upper() == 'OPTIONS':
        return options()

    verified = verify_user(event)

    if not (verified and verified['email'] == os.environ['RH_USERNAME']):
        return error(401, 'This account is not verified.')
    params = event["queryStringParameters"]
    variant = str_to_bool(str(params and params.get('variant')))
    login(variant)
    response = get_trade()
    return response


def handle_ws(event, _):
    # print('event', event)
    verified = verify_token(event)

    if not (verified and verified['email'] == os.environ['RH_USERNAME']):
        print('websocket auth failure')
        return error(401, 'This account is not verified.')

    context = event['requestContext']
    domain = context['domainName']
    connection = context['connectionId']
    callback = f'https://{domain}'

    client = boto3.client('apigatewaymanagementapi', endpoint_url=callback)
    req_body = json.loads(event['body'])
    variant = bool(req_body.get('variant'))
    login(variant)
    response = post_trade(event)
    # convert response to bytes
    data = json.dumps(response).encode('utf-8')
    client.post_to_connection(Data=data, ConnectionId=connection)
    client.delete_connection(ConnectionId=connection)
    client.close()

    # print(event)
    return {
        "statusCode": 200,
        "body": 'OK',
        "headers": {"Access-Control-Allow-Origin": "*"}
    }


def login(variant=False):
    postfix = '2' if variant else ''
    ext = '.pickle'
    filename = 'robinhood'
    auth_path = os.path.join(os.path.expanduser(
        "~"), '.tokens', f'{filename}{ext}')
    key = f'data/{filename}{postfix}{ext}'
    try:
        Path(auth_path).parent.mkdir(parents=True, exist_ok=True)
        with open(auth_path, 'wb') as file:
            bucket = s3.Bucket(os.environ['S3_BUCKET'])
            bucket.download_fileobj(key, file)
            print('Loaded auth file from S3.')
    except ClientError:
        print('Could not load auth file from S3.')
        os.remove(auth_path)
    username = os.environ[f'RH_USERNAME{postfix}']
    password = os.environ[f'RH_PASSWORD{postfix}']
    mfa_code = pyotp.TOTP(os.environ[f'RH_2FA{postfix}']).now()
    rh.login(username, password, mfa_code=mfa_code)
    if os.path.exists(auth_path):
        bucket.upload_file(auth_path, key)
        print('Saved auth file to S3.')


def get_trade():
    holdings = rh.build_holdings()
    for symbol in holdings:
        holdings[symbol]['symbol'] = symbol
        holdings[symbol]['open_contracts'] = 0
    opts = rh.options.get_open_option_positions()
    for opt in opts:
        sold = -1 if opt['type'] == 'short' else 1
        holdings[opt['chain_symbol']
                 ]['open_contracts'] += int(float(opt['quantity'])) * sold
        opt = rh.options.get_option_instrument_data_by_id(opt['option_id'])
        holdings[opt['chain_symbol']
                 ]['option_type'] = opt['type'][0].upper()
        holdings[opt['chain_symbol']
                 ]['expiration'] = opt['expiration_date']
        holdings[opt['chain_symbol']]['strike'] = float(
            opt['strike_price'])
        opt = rh.options.get_option_market_data_by_id(opt['id'])[0]
        postfix = 'short' if holdings[opt['symbol']
                                      ]['open_contracts'] < 0 else 'long'
        chance = opt[f'chance_of_profit_{postfix}']
        holdings[opt['symbol']]['chance'] = float(chance) if chance else chance
    holdings = sorted([holding for _, holding in holdings.items()],
                      key=lambda holding: holding['symbol'])
    body = [holding | {'key': idx} for idx, holding in enumerate(holdings)]
    status_code = 200

    return {
        "statusCode": status_code,
        "body": json.dumps(body),
        "headers": {"Access-Control-Allow-Origin": "*"}
    }


def post_trade(event):
    req_body = json.loads(event['body'])
    trade_type = req_body['type']
    symbols = req_body['symbols']
    trade = Buy() if trade_type.upper() == 'BUY' else Sell()
    results = trade.execute(symbols)
    return results
    status_code = 200

    return {
        "statusCode": status_code,
        "body": json.dumps(results),
        "headers": {"Access-Control-Allow-Origin": "*"}
    }


def get_week(date):
    one_day = timedelta(days=1)
    day_idx = (date.weekday() + 1) % 7
    sunday = date - timedelta(days=day_idx)
    return [i * one_day + sunday for i in range(7)]


def get_mid_price(opt):
    return (float(opt['ask_price']) + float(opt['bid_price'])) / 2


def round(n, decimals=0, dir='UP'):
    fx = ceil if dir.upper() == 'UP' else floor
    multiplier = 10**decimals
    return fx(n * multiplier) / multiplier


def suggest_num_contracts():
    holdings = rh.build_holdings()
    max_contracts = {symbol: int(
        float(holding['quantity']) / 100) for symbol, holding in holdings.items()}
    instr_to_symbol_lookup = {
        holding['id']: symbol for symbol, holding in holdings.items()}
    positions = rh.account.get_open_stock_positions()
    curr_contracts = defaultdict(int, {instr_to_symbol_lookup[position['instrument_id']]: int(
        float(position['shares_held_for_options_collateral']) / 100) for position in positions})
    available_contracts = {symbol: max_contract -
                           curr_contracts[symbol] for symbol, max_contract in max_contracts.items()}
    return available_contracts


def get_expirations(expirations, num=2):
    today = datetime.now()
    week = set([datetime.strftime(day, '%Y-%m-%d') for day in get_week(today)])
    for idx, exp in enumerate(expirations):
        if exp not in week:
            break
    offset = int(bool(idx))
    exp_candidates = expirations[idx - offset: idx + num - offset]
    return exp_candidates


def get_contracts(symbol, expiration, curr_price, num=2):
    min_price = 0.05
    key = 'high_fill_rate_sell_price'
    opt_candidates = rh.options.find_options_by_specific_profitability(
        symbol, expiration, None, 'call', 'chance_of_profit_short', 0.85, 0.95)
    # only use options that with a strike price above current stock price
    opt_candidates = [
        opt for opt in opt_candidates
        if float(opt['strike_price']) > curr_price
    ]

    opt_candidates.sort(key=lambda opt: abs(
        float(opt['chance_of_profit_short']) - 0.88))
    contracts = [opt for opt in opt_candidates if (
        float(opt[key]) if key in opt and opt[key] else get_mid_price(opt)
    ) >= min_price]
    return contracts[0: num]


def spread_is_high(mid_price, price):
    print('mid_price', mid_price)
    print('price', price)
    # issue here where spread_is_high is being reached with < 5 dollar diff
    # should be exception where <$5 diff is allowed
    is_high = abs((mid_price - price) / mid_price) > 0.2
    print('is_high', is_high)
    return is_high


def update_contract(symbol, lookup):
    option = lookup[symbol]
    curr = option['curr']
    contracts = option['contracts']
    old = contracts[curr[0]][curr[1]]
    new = rh.options.get_option_market_data_by_id(old['id'])[0]
    lookup[symbol]['contracts'][curr[0]][curr[1]] = old | new
    return lookup


def delay():
    sleep(random() * 5 + 5)


class Trade:
    # curr[x, y, z]
    # x is expiration index
    # y is contract index
    # z is price index
    def execute(self, symbols):
        results = {}
        lookup = self.init_chain(symbols)

        while set(lookup.keys()) != set(results.keys()):
            orders = self.execute_orders(lookup, results)

            # wait 5-10 sec
            delay()

            lookup, results = self.adjust_orders(orders, lookup, results)
        return results

    def adjust_orders(self, orders, lookup, results):
        for symbol in orders:
            id = orders[symbol].get('id')
            if id:
                rh.orders.cancel_option_order(id)
                order = rh.orders.get_option_order_info(id)
            if id and order['state'] == 'filled':
                results[symbol] = order
            elif not id or order['state'] == 'cancelled':
                lookup, results = self.adjust_option(symbol, lookup, results)
        return lookup, results


class Sell(Trade):
    def init_chain(self, symbols):
        desired_contracts = suggest_num_contracts()
        # only use symbols that have positions available
        symbols = [symbol for symbol,
                   num_contracts in desired_contracts.items() if num_contracts]
        prices = rh.stocks.get_latest_price(symbols)
        lookup = {
            symbol: {
                'quantity': desired_contracts[symbol],
                'curr': [0, 0, 0],
                'price': prices[symbol]
            } for symbol in symbols
        }

        for symbol in lookup:
            chain = rh.options.get_chains(symbol)
            price = lookup[symbol]['price']
            expirations = chain['expiration_dates']
            expirations = get_expirations(expirations)
            print('expirations', expirations)
            lookup[symbol]['expirations'] = expirations
            # maybe turn these two lines into a fx called update_contracts and run before every trade attempt
            contracts = [get_contracts(symbol, exp, price)
                         for exp in expirations]
            lookup[symbol]['contracts'] = contracts
        return lookup

    def get_price(self, contract, offset):
        mid_price = get_mid_price(contract)
        # get mid price to two decimal places
        price = round(mid_price, 2, 'UP')
        # option price increment/step (e.g. 0.01 per contract or 0.05)
        min_tick = float(contract['min_ticks']['below_tick'])
        # round price up to tick
        price = ceil(price / min_tick) * min_tick
        # lower price based on attempt
        price -= min_tick * offset
        return price

    def adjust_option(self, symbol, lookup, results):
        option = lookup[symbol]
        curr = option['curr']
        contracts = option['contracts']
        if not contracts[curr[0]]:
            if curr[0] == len(option['expirations']) - 1:
                results[symbol] = {'error': 'EXHAUSTED'}
            else:
                lookup[symbol]['curr'] = [curr[0] + 1, 0, 0]
        else:
            curr[2] += 1
            contract = contracts[curr[0]][curr[1]]
            mid_price = get_mid_price(contract)
            price = self.get_price(contract, curr[2])

            if spread_is_high(mid_price, price):
                print(
                    symbol,
                    f"""
                    Price spread is high.
                    Bid: {float(contract["bid_price"])}
                    Ask: {float(contract["ask_price"])}
                    Mid: {mid_price} Price: {price}
                    """
                )
                curr[2] = 0
                if curr[1] == len(contracts[curr[0]]) - 1:
                    curr[1] = 0
                    if curr[0] == len(option['expirations']) - 1:
                        results[symbol] = {'error': 'EXHAUSTED'}
                    else:
                        print('Seeking further expiration date...')
                        curr[0] += 1
                else:
                    curr[1] += 1
        lookup = update_contract(symbol, lookup)
        return lookup, results

    def execute_orders(self, lookup, results):
        remaining = [symbol for symbol in lookup if symbol not in results]
        orders = {}
        for idx, symbol in enumerate(remaining):
            option = lookup[symbol]
            curr = option['curr']
            expiration = option['expirations'][curr[0]]
            contract_candidates = option['contracts'][curr[0]]
            if contract_candidates:
                contract = contract_candidates[curr[1]]

                strike = float(contract['strike_price'])
                price = self.get_price(contract, curr[2])
                quantity = option['quantity']

                order = rh.orders.order_sell_option_limit(
                    'open', 'credit', price, symbol, quantity, expiration, strike, 'call')
                print('Order:', json.dumps(order))
                orders[symbol] = order
            else:
                orders[symbol] = {'state': 'cancelled'}
            if idx == len(remaining) - 1:
                delay()
        return orders


class SellOut(Trade):
    pass


class SellIn(Trade):
    pass


class Buy(Trade):
    def init_chain(self, symbols):
        opts = rh.options.get_aggregate_open_positions()
        symbols = set(symbols)
        pattern = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}"
        tradeable = {
            opt['symbol']: {
                'quantity': int(float(opt['quantity'])),
                'expiration': opt['legs'][0]['expiration_date'],
                'strike': float(opt['legs'][0]['strike_price']),
                'curr': 0,
                'id': (
                    re.search(pattern, opt['legs'][0]['option'], re.IGNORECASE)
                    or re.search(pattern, opt['strategy_code'], re.IGNORECASE)
                )[0],
            } for opt in opts if (
                opt['symbol'] in symbols and
                opt['strategy'] == 'short_call'
            )
        }
        lookup = {
            symbol:
            info | {
                'contract':
                rh.options.get_option_market_data_by_id(info['id'])[0] | {
                    'min_ticks':
                    rh.options.get_option_instrument_data_by_id(info['id'])[
                        'min_ticks']
                }} for symbol, info in tradeable.items()}
        return lookup

    def get_price(self, contract, offset):
        # THIS FX STILL NEEDS TO BE CONVERTED
        # need to make sure contract has bid prices and ticks - DONE
        mid_price = get_mid_price(contract)
        # get mid price to two decimal places
        price = round(mid_price, 2, 'DOWN')  # CONVERTED
        # option price increment/step (e.g. 0.01 per contract or 0.05)
        # use instrument_data_by_id fx in init_chain to get this? - DONE
        min_tick = float(contract['min_ticks']['above_tick'])
        # round price down to tick
        # this should be floor? - DONE
        price = floor(price / min_tick) * min_tick
        # lower price based on attempt
        price += min_tick * offset  # this should be plus? - DONE
        return price

    def adjust_option(self, symbol, lookup, _):
        option = lookup[symbol]
        option['curr'] += 1
        curr = option['curr']
        contract = option['contract']
        mid_price = get_mid_price(contract)
        price = self.get_price(contract, curr)

        if spread_is_high(mid_price, price):
            print(
                symbol,
                f"""
                Price spread is high.
                Bid: {float(contract["bid_price"])}
                Ask: {float(contract["ask_price"])}
                Mid: {mid_price} Price: {price}
                """
            )

        lookup[symbol] = option
        return lookup, _

    def execute_orders(self, lookup, results):
        remaining = [symbol for symbol in lookup if symbol not in results]
        orders = {}
        for idx, symbol in enumerate(remaining):
            option = lookup[symbol]
            quantity = option['quantity']
            expiration = option['expiration']
            strike = option['strike']
            price = self.get_price(option['contract'], option['curr'])
            order = rh.orders.order_buy_option_limit(
                'close', 'debit', price, symbol,
                quantity, expiration, strike, 'call'
            )
            print('Order:', json.dumps(order))
            orders[symbol] = order
            if idx == len(remaining) - 1:
                delay()
        return orders


def roll_out(symbols):
    # need to buy and have wait and retry
    trade = Buy()
    buy_results = trade.execute(symbols)
    trade = SellOut()
    sell_results = trade.execute(symbols, buy_results)
    # TODO: return sell minus buy results
    return sell_results


def roll_in(symbols):
    # also implement rolling in as well as out
    trade = Buy()
    buy_results = trade.execute(symbols)
    trade = SellIn()
    sell_results = trade.execute(symbols, buy_results)
    # TODO: return sell minus buy results
    return sell_results


# also need to add tests backend and frontend
# also need to create scripts that run at noon each weekday for sell => then rolling in
# and 2pm or 3pm each day testing if any open positions are expiring same day => then rolling out
