/**
 * Inline, non-clickable payment brand marks used on the "Pay your way" strip.
 * Pure SVG so they stay crisp and never trigger network fetches.
 */

export function VisaMark() {
  return (
    <svg viewBox="0 0 120 40" role="img" aria-label="Visa" className="h-7 w-auto">
      <text
        x="0"
        y="30"
        fontFamily="Arial Black, Arial, sans-serif"
        fontSize="30"
        fontStyle="italic"
        fontWeight="900"
        fill="#1A1F71"
        letterSpacing="1"
      >
        VISA
      </text>
    </svg>
  );
}

export function MastercardMark() {
  return (
    <svg viewBox="0 0 76 44" role="img" aria-label="Mastercard" className="h-8 w-auto">
      <circle cx="28" cy="22" r="16" fill="#EB001B" />
      <circle cx="48" cy="22" r="16" fill="#F79E1B" />
      <path d="M38 10a16 16 0 0 0 0 24 16 16 0 0 0 0-24Z" fill="#FF5F00" />
    </svg>
  );
}

export function VerveMark() {
  return (
    <svg viewBox="0 0 130 40" role="img" aria-label="Verve" className="h-6 w-auto">
      <rect x="0" y="6" width="28" height="28" rx="6" fill="#00425F" />
      <path
        d="M7 14l7 13 7-13"
        stroke="#EE3124"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      <text
        x="36"
        y="29"
        fontFamily="Arial, sans-serif"
        fontSize="22"
        fontWeight="800"
        fill="#00425F"
      >
        verve
      </text>
    </svg>
  );
}

export function PaystackMark() {
  return (
    <svg viewBox="0 0 150 40" role="img" aria-label="Paystack" className="h-6 w-auto">
      <g fill="#00C3F7">
        <rect x="0" y="7" width="26" height="5" rx="1.6" />
        <rect x="0" y="15" width="26" height="5" rx="1.6" />
        <rect x="0" y="23" width="18" height="5" rx="1.6" />
        <rect x="0" y="31" width="26" height="5" rx="1.6" />
      </g>
      <text
        x="34"
        y="30"
        fontFamily="Arial, sans-serif"
        fontSize="22"
        fontWeight="800"
        fill="#011B33"
      >
        paystack
      </text>
    </svg>
  );
}

export function FlutterwaveMark() {
  return (
    <svg viewBox="0 0 170 40" role="img" aria-label="Flutterwave" className="h-6 w-auto">
      <path d="M4 30 L16 8 L28 30 Z" fill="#F5A623" />
      <circle cx="16" cy="33" r="3.4" fill="#F5A623" />
      <text
        x="36"
        y="29"
        fontFamily="Arial, sans-serif"
        fontSize="21"
        fontWeight="800"
        fill="#0B1B2B"
      >
        flutterwave
      </text>
    </svg>
  );
}

export function MiniPayMark() {
  return (
    <svg viewBox="0 0 140 40" role="img" aria-label="MiniPay" className="h-6 w-auto">
      <rect x="0" y="8" width="26" height="24" rx="8" fill="#00D26B" />
      <path
        d="M7 26V14l6 7 6-7v12"
        stroke="#04231A"
        strokeWidth="2.6"
        fill="none"
        strokeLinejoin="round"
      />
      <text
        x="34"
        y="29"
        fontFamily="Arial, sans-serif"
        fontSize="21"
        fontWeight="800"
        fill="#04231A"
      >
        MiniPay
      </text>
    </svg>
  );
}

export function MtnMomoMark() {
  return (
    <svg viewBox="0 0 150 44" role="img" aria-label="MTN Mobile Money" className="h-8 w-auto">
      <rect x="0" y="6" width="66" height="32" rx="16" fill="#FFCC00" />
      <text
        x="9"
        y="29"
        fontFamily="Arial Black, Arial, sans-serif"
        fontSize="18"
        fontWeight="900"
        fill="#00263A"
      >
        MTN
      </text>
      <text
        x="74"
        y="29"
        fontFamily="Arial, sans-serif"
        fontSize="19"
        fontWeight="800"
        fill="#00263A"
      >
        MoMo
      </text>
    </svg>
  );
}

export function BankTransferMark() {
  return (
    <svg viewBox="0 0 170 40" role="img" aria-label="Bank transfer" className="h-6 w-auto">
      <path d="M14 10 L26 17 H2 Z" fill="#334155" />
      <rect x="5" y="19" width="3.5" height="10" fill="#334155" />
      <rect x="12.5" y="19" width="3.5" height="10" fill="#334155" />
      <rect x="20" y="19" width="3.5" height="10" fill="#334155" />
      <rect x="2" y="30" width="24" height="3.5" rx="1.5" fill="#334155" />
      <text
        x="34"
        y="29"
        fontFamily="Arial, sans-serif"
        fontSize="20"
        fontWeight="800"
        fill="#334155"
      >
        Bank Transfer
      </text>
    </svg>
  );
}
