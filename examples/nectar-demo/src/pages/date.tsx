import * as dateFns from 'date-fns';

export default function DatePage() {
    const now = new Date();
    const formatted = dateFns.format(now, 'yyyy-MM-dd');
    const parsed = dateFns.parseISO('2025-10-01');
    const added = dateFns.addDays(parsed, 7);

    return (
        <div>
            <h1>Date</h1>
            <p>Today: {formatted}</p>
            <p>Parsed date + 7 days: {dateFns.format(added, 'PPP')}</p>
        </div>
    );
}

