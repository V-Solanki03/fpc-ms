"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { fontSize: 11, fill: "rgb(var(--muted))" };
const tip = { background: "rgb(var(--panel))", border: "1px solid rgb(var(--line))", borderRadius: 8, fontSize: 12 };
export function TrendChart({ data, lines }: { data: any[]; lines: { key: string; label: string; color: string }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={40} />
          <Tooltip contentStyle={tip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {lines.map((l) => <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color} strokeWidth={2} dot={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function BarsChart({ data, bars, stacked }: { data: any[]; bars: { key: string; label: string; color: string }[]; stacked?: boolean }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval={0} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={40} />
          <Tooltip contentStyle={tip} cursor={{ fill: "rgb(var(--soft))" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {bars.map((b) => <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} stackId={stacked ? "a" : undefined} radius={stacked ? 0 : [4, 4, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export { Area, AreaChart };
