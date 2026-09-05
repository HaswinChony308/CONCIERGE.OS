import os

from payments.client import PaymentClient  # noqa: F401


def get_payment_client() -> PaymentClient:
    mode = os.environ.get("RAZORPAY_MODE", "mock")
    if mode == "mock":
        from payments.mock_client import MockRazorpayClient
        return MockRazorpayClient()
    elif mode == "live_test":
        from payments.razorpay_client import RazorpayTestClient
        return RazorpayTestClient()
    else:
        raise ValueError(f"unknown RAZORPAY_MODE={mode!r}, expected 'mock' or 'live_test'")
