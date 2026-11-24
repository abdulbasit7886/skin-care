export const formatMoney = (n) => `Rs ${Number(n || 0).toLocaleString()}`;

// What a visit was invoiced for. PRA tax is already inside the consultation
// charge, so it is not added on top.
export const invoicedTotal = (inv) => Number(inv?.total || 0);