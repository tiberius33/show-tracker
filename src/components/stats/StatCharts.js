import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid
} from 'recharts';

// Parse date string to Date object
function parseDate(dateStr) {
  if (!dateStr) return new Date(0);
  const ddmmyyyy = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) return new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`);
  const d = new Date(dateStr);
  return isNaN(d) ? new Date(0) : d;
}

// Custom tooltip styles
const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#1e293b',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '8px 12px'
  },
  labelStyle: { color: 'white', fontWeight: 500 },
  itemStyle: { color: 'rgba(255,255,255,0.8)' }
};

export function ShowsOverTimeChart({ shows }) {
  const data = useMemo(() => {
    const byMonth = {};
    shows.forEach(show => {
      const date = parseDate(show.date);
      if (date.getFullYear() > 1970) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        byMonth[key] = (byMonth[key] || 0) + 1;
      }
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-24) // Last 24 months
      .map(([month, count]) => {
        const [year, m] = month.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return {
          month: `${monthNames[parseInt(m) - 1]} '${year.slice(2)}`,
          count
        };
      });
  }, [shows]);

  if (data.length === 0) {
    return <EmptyChart message="No show data to display" />;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          dataKey="month"
          stroke="rgba(255,255,255,0.5)"
          fontSize={11}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="rgba(255,255,255,0.5)"
          fontSize={11}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip {...tooltipStyle} />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ fill: '#10b981', strokeWidth: 0, r: 4 }}
          activeDot={{ r: 6, fill: '#10b981' }}
          name="Shows"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TopArtistsChart({ shows }) {
  const data = useMemo(() => {
    const artistCounts = {};
    shows.forEach(show => {
      if (show.artist) {
        artistCounts[show.artist] = (artistCounts[show.artist] || 0) + 1;
      }
    });
    return Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, shows]) => ({
        name: name.length > 18 ? name.substring(0, 18) + '...' : name,
        fullName: name,
        shows
      }));
  }, [shows]);

  if (data.length === 0) {
    return <EmptyChart message="No artist data to display" />;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <XAxis type="number" stroke="rgba(255,255,255,0.5)" fontSize={11} tickLine={false} />
        <YAxis
          dataKey="name"
          type="category"
          width={100}
          stroke="rgba(255,255,255,0.5)"
          fontSize={11}
          tickLine={false}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(value, name, props) => [value, 'Shows']}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
        />
        <Bar dataKey="shows" fill="#10b981" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RatingDistributionChart({ shows }) {
  const data = useMemo(() => {
    const distribution = Array(10).fill(0);
    shows.forEach(show => {
      if (show.rating >= 1 && show.rating <= 10) {
        distribution[show.rating - 1]++;
      }
    });
    return distribution.map((count, i) => ({ rating: i + 1, count }));
  }, [shows]);

  const hasRatings = data.some(d => d.count > 0);
  if (!hasRatings) {
    return <EmptyChart message="No rated shows yet" />;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <XAxis dataKey="rating" stroke="rgba(255,255,255,0.5)" fontSize={11} tickLine={false} />
        <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} tickLine={false} allowDecimals={false} />
        <Tooltip {...tooltipStyle} formatter={(value) => [value, 'Shows']} />
        <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopSongsChart({ shows }) {
  const data = useMemo(() => {
    const songCounts = {};
    shows.forEach(show => {
      (show.setlist || []).forEach(song => {
        if (song.name) {
          const key = song.name.toLowerCase().trim();
          if (!songCounts[key]) {
            songCounts[key] = { name: song.name, count: 0 };
          }
          songCounts[key].count++;
        }
      });
    });
    return Object.values(songCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(s => ({
        name: s.name.length > 20 ? s.name.substring(0, 20) + '...' : s.name,
        fullName: s.name,
        count: s.count
      }));
  }, [shows]);

  if (data.length === 0) {
    return <EmptyChart message="No song data to display" />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <XAxis type="number" stroke="rgba(255,255,255,0.5)" fontSize={11} tickLine={false} />
        <YAxis
          dataKey="name"
          type="category"
          width={130}
          stroke="rgba(255,255,255,0.5)"
          fontSize={11}
          tickLine={false}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(value) => [value, 'Times Heard']}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
        />
        <Bar dataKey="count" fill="#14b8a6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-white/40">
      {message}
    </div>
  );
}
