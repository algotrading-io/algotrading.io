import sys
sys.path.append('src/api')  # noqa
from trade.app import chance_of_profit  # noqa


def test_chance_of_profit():
    chance = chance_of_profit(
        stock_price=240.80, strike_price=255,
        implied_vol=0.9992, rho=-0.0007,
        div_yield=0, time=0.00205
    )
    assert int(chance * 100) == 90
