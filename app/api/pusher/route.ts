import { NextRequest, NextResponse } from 'next/server';
import pusher from '@/app/lib/pusher';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { channel, event, data } = body;

        if (!channel || !event || !data) {
            return NextResponse.json({ error: 'Missing channel, event, or data' }, { status: 400 });
        }

        await pusher.trigger(channel, event, data);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Pusher trigger error:', error);
        return NextResponse.json({ error: 'Failed to trigger event' }, { status: 500 });
    }
}
