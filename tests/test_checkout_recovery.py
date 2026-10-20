"""Definite rejection and ambiguous responses must never be confused."""
import unittest
import test_payments
from vkplay import BillingRejected


class CheckoutRecovery(unittest.TestCase):
    setUp = test_payments.Payments.setUp
    tearDown = test_payments.Payments.tearDown
    order = test_payments.Payments.order
    receipt = test_payments.Payments.receipt
    balance = test_payments.Payments.balance


def rejection(self):
    original = self.fake.__class__.__call__
    def reject(_transport, method, url, data=None):
        return {'status': 'error', 'errcode': 2004}
    self.fake.__class__.__call__ = reject
    try:
        with self.assertRaises(BillingRejected):
            self.order('starter')
        self.assertEqual(self.balance(), 120)
        self.assertEqual(self.store.db.execute('SELECT status FROM vk_orders').fetchone()[0], 'failed')
    finally:
        self.fake.__class__.__call__ = original
    # A definite failure releases the one-time product for a new request.
    result = self.order('starter', 'new-request')
    self.assertEqual(result['status'], 'pending')
    self.assertEqual(self.balance(), 120)


def paid_without_url(self):
    self.fake.fail = True
    with self.assertRaises(TimeoutError):
        self.order()
    row = self.store.db.execute('SELECT id FROM vk_orders').fetchone()
    self.store.callback(self.receipt({'orderId': row['id']}))
    # A late receipt is authoritative, even if no checkout URL was received.
    result = self.order()
    self.assertEqual(result, {'orderId': row['id'], 'status': 'paid'})
    self.assertEqual(self.balance(), 620)


CheckoutRecovery.test_definite_failure_allows_safe_new_request = rejection
CheckoutRecovery.test_paid_order_recovers_without_url = paid_without_url
