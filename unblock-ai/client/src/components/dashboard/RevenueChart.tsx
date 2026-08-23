import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Point {
  day: string;
  recovered: number;
  at_risk: number;
}

export default function RevenueChart({ data }: { data: Point[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="recoveredGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-recovered)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-recovered)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-risk)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-risk)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-text-dim)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-text-dim)" }} axisLine={false} tickLine={false} width={44} />
        <Tooltip
          contentStyle={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--color-text-muted)" }}
        />
        <Area type="monotone" dataKey="at_risk" stroke="var(--color-risk)" fill="url(#riskGrad)" strokeWidth={1.5} name="At risk" />
        <Area type="monotone" dataKey="recovered" stroke="var(--color-recovered)" fill="url(#recoveredGrad)" strokeWidth={1.5} name="Recovered" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
