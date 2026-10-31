import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

const isOnline = () => onlineManager.isOnline();

/** Whether the phone has a connection right now (`@/data/connection` keeps this current). */
export const useIsOnline = (): boolean => useSyncExternalStore(onlineManager.subscribe, isOnline);
