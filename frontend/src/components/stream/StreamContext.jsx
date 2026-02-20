import { createContext, useContext, useRef, useState } from 'react';

const StreamContext = createContext(null);

export function StreamProvider({ children }) {
    const webrtcRef = useRef(null);

    const [sessionInfo, setSessionInfo] = useState(null);
    // sessionInfo shape:
    // { mode: 'transmitter' | 'monitor', device, streamStartTime: Date, onStop: async fn }

    return (
        <StreamContext.Provider value={{ webrtcRef, sessionInfo, setSessionInfo }}>
            {children}
        </StreamContext.Provider>
    );
}

export function useStream() {
    const ctx = useContext(StreamContext);
    if (!ctx) throw new Error('useStream must be used inside StreamProvider');
    return ctx;
}
