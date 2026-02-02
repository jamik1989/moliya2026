function formatNumber(num) {
  return (num || 0).toLocaleString('uz-UZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatMoney(amount) {
  amount = Number(amount) || 0;
  if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return (amount / 1000).toFixed(1) + 'K';
  return new Intl.NumberFormat('uz-UZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}
