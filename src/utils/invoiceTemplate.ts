import type { Booking } from '../types/booking.types';

const SELLER = {
  name: 'CRESCENDO TRANSCRIPTION PRIVATE LIMITED',
  address: 'T-20, STPI, Opp. Garware Stadium, Beside MSEB Sub Station,\nChikalthana MIDC, Aurangabad 431001 Maharashtra, India',
  gstin: '27AAFCC7012E1Z1',
  state: 'Maharashtra',
  stateCode: '27',
  cin: 'U74120MH2014PTC255779',
  email: 'crescendoconnect@gmail.com',
};

const GST_RATE = 0.18;
const SAC_CODE = '9996';

function toWords(n: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (n === 0) return 'Zero';
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + toWords(n % 100) : '');
  if (n < 100000) return toWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + toWords(n % 1000) : '');
  if (n < 10000000) return toWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + toWords(n % 100000) : '');
  return toWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + toWords(n % 10000000) : '');
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

export function buildInvoiceHtml(
  booking: Booking,
  customerName: string,
  customerEmail: string,
  customerPhone: string,
): string {
  const total = Number(booking.amount);
  // Back-calculate taxable from total (total = taxable * 1.18)
  const taxable = +(total / (1 + GST_RATE)).toFixed(2);
  const cgst = +((taxable * GST_RATE) / 2).toFixed(2);
  const sgst = cgst;
  const grandTotal = taxable + cgst + sgst;

  const invoiceNo = booking.invoiceNumber ?? '—';
  const invoiceDate = formatDate(booking.bookingDate);
  const venueName = (booking.venue as any)?.name ?? 'Venue';
  const venueAddress = (booking.venue as any)?.address ?? '';
  const courtName = (booking.court as any)?.name ?? booking.courtLabel ?? 'Court';
  const description = `${courtName} — ${venueName}<br/>${venueAddress ? venueAddress + '<br/>' : ''}${formatDate(booking.bookingDate)}, ${to12h(booking.startTime)} to ${to12h(booking.endTime)}`;
  const paymentId = booking.razorpayPaymentId ?? '—';
  const orderId = booking.razorpayOrderId ?? '—';

  const amountInWords = `INR ${toWords(Math.round(grandTotal))} Only`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Tax Invoice ${invoiceNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; }
  .page { max-width: 794px; margin: 0 auto; padding: 24px; }
  h1 { text-align: center; font-size: 18px; letter-spacing: 2px; border: 2px solid #111; padding: 8px; margin-bottom: 0; }
  table.layout { width: 100%; border-collapse: collapse; }
  table.layout td { vertical-align: top; padding: 8px; border: 1px solid #999; }
  .label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
  .val { font-weight: bold; margin-top: 2px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 0; }
  table.items th, table.items td { border: 1px solid #999; padding: 7px 8px; }
  table.items th { background: #f0f0f0; font-size: 11px; text-align: center; }
  table.items td { font-size: 12px; }
  .right { text-align: right; }
  .center { text-align: center; }
  .total-row td { font-weight: bold; background: #f7f7f7; }
  .footer { margin-top: 24px; font-size: 11px; color: #555; border-top: 1px solid #ccc; padding-top: 12px; }
  .words { background: #f9f9f9; border: 1px solid #ddd; padding: 8px 12px; margin-top: 0; border-top: none; font-style: italic; }
  .sign-row td { height: 60px; vertical-align: bottom; font-size: 11px; }
</style>
</head>
<body>
<div class="page">

  <h1>TAX INVOICE</h1>

  <!-- Seller / Invoice meta -->
  <table class="layout">
    <tr>
      <td style="width:60%">
        <div style="font-weight:bold;font-size:13px;margin-bottom:4px">${SELLER.name}</div>
        <div style="white-space:pre-line;line-height:1.6">${SELLER.address}</div>
        <div style="margin-top:6px"><span class="label">GSTIN/UIN:</span> <b>${SELLER.gstin}</b></div>
        <div><span class="label">State Name:</span> ${SELLER.state}, <span class="label">Code:</span> ${SELLER.stateCode}</div>
        <div><span class="label">CIN:</span> ${SELLER.cin}</div>
        <div><span class="label">E-Mail:</span> ${SELLER.email}</div>
      </td>
      <td style="width:40%">
        <div><span class="label">Invoice No.</span><div class="val">${invoiceNo}</div></div>
        <div style="margin-top:10px"><span class="label">Invoice Date</span><div class="val">${invoiceDate}</div></div>
        <div style="margin-top:10px"><span class="label">Payment Reference</span><div class="val" style="font-size:10px;word-break:break-all">${paymentId}</div></div>
        <div style="margin-top:4px"><span class="label">Razorpay Order ID</span><div class="val" style="font-size:10px;word-break:break-all">${orderId}</div></div>
      </td>
    </tr>
  </table>

  <!-- Buyer -->
  <table class="layout">
    <tr>
      <td colspan="2">
        <div class="label" style="margin-bottom:4px">Bill To</div>
        <div style="font-weight:bold;font-size:13px">${customerName}</div>
        <div>${customerEmail}</div>
        <div>${customerPhone}</div>
        <div><span class="label">Place of Supply:</span> Maharashtra (27)</div>
      </td>
    </tr>
  </table>

  <!-- Items -->
  <table class="items">
    <thead>
      <tr>
        <th style="width:5%">#</th>
        <th style="text-align:left;width:45%">Description of Service</th>
        <th style="width:10%">HSN/SAC</th>
        <th style="width:8%">Qty</th>
        <th style="width:12%">Rate (₹)</th>
        <th style="width:12%">Taxable Value (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="center">1</td>
        <td>${description}</td>
        <td class="center">${SAC_CODE}</td>
        <td class="center">1</td>
        <td class="right">${taxable.toFixed(2)}</td>
        <td class="right">${taxable.toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="5" class="right" style="font-weight:bold">Taxable Amount</td>
        <td class="right" style="font-weight:bold">₹${taxable.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Tax breakdown -->
  <table class="items">
    <thead>
      <tr>
        <th style="text-align:left">Tax Component</th>
        <th>Rate</th>
        <th>Taxable Amount (₹)</th>
        <th>Tax Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>CGST</td>
        <td class="center">9%</td>
        <td class="right">${taxable.toFixed(2)}</td>
        <td class="right">${cgst.toFixed(2)}</td>
      </tr>
      <tr>
        <td>SGST</td>
        <td class="center">9%</td>
        <td class="right">${taxable.toFixed(2)}</td>
        <td class="right">${sgst.toFixed(2)}</td>
      </tr>
      <tr class="total-row">
        <td colspan="3" class="right">Total Tax</td>
        <td class="right">₹${(cgst + sgst).toFixed(2)}</td>
      </tr>
      <tr class="total-row">
        <td colspan="3" class="right">Grand Total (Rounded)</td>
        <td class="right">₹${Math.round(grandTotal).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Amount in words -->
  <div class="words">${amountInWords}</div>

  <!-- Signature -->
  <table class="layout" style="margin-top:24px">
    <tr class="sign-row">
      <td style="width:50%">
        <div class="label">Terms &amp; Conditions</div>
        <div style="margin-top:6px;font-size:11px">
          Payment is non-refundable unless cancelled as per Cancellation Policy.<br/>
          This is a computer-generated invoice and does not require a physical signature.
        </div>
      </td>
      <td style="width:50%;text-align:right">
        <div style="font-weight:bold;font-size:13px">${SELLER.name}</div>
        <div style="margin-top:32px;border-top:1px solid #555;padding-top:4px;font-size:11px">Authorised Signatory</div>
      </td>
    </tr>
  </table>

  <div class="footer">
    This is a system-generated document. For queries write to ${SELLER.email}.
  </div>

</div>
</body>
</html>`;
}
