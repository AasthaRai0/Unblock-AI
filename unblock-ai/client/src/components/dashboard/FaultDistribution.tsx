import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { faultPartyLabel } from "../../utils/format";

interface Slice {
  fault_party: string;
  count: number;
  amount: number;
}

const COLORS: Record<string, string> = {
  CUSTOMER: "#6E7BF2",
  VENDOR: "#F5A623",
  PLATFORM: "#F0555A",
  GATEWAY: "#2FD69B",
  AMBIGUOUS: "#565F70",
};

export default function FaultDistribution({ data }: { data: Slice[] }) {
  const chartData = data.map((d) => ({ name: faultPartyLabel(d.fault_party), value: d.count, raw: d.fault_party }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={COLORS[entry.raw] ?? "#565F70"} stroke="var(--color-surface)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={24}
          iconSize={8}
          formatter={(value) => <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
