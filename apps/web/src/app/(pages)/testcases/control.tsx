'use client';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export function Control({
  currentFile,
  useBrowser,
  useMobile,
  running,
  connected,
  setUseBrowser,
  setUseMobile,
  setRunning,
  run,
}: {
  currentFile: string;
  useBrowser: boolean;
  useMobile: boolean;
  running: boolean;
  connected: boolean;
  setUseBrowser: (checked: boolean) => void;
  setUseMobile: (checked: boolean) => void;
  setRunning: (run: boolean) => void;
  run: () => Promise<void>;
}) {
  return (
    <div className="flex justify-between items-center rounded-lg shadow-sm ">
      <div>
        {currentFile ? (
          <Button
            variant={'outline'}
            size={'sm'}
            onClick={() => {
              !running && run();
              setRunning(!running);
            }}
          >
            {!running ? 'Execute' : 'Running'}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-row gap-3 pr-2">
        <strong>Server Status:</strong>{' '}
        <span style={{ color: connected ? 'green' : 'red' }}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </div>
  );
}
