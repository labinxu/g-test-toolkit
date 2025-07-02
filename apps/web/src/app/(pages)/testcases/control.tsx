'use client';
import { Button } from '@/components/ui/button';

export function Control({
  currentFile,
  running,
  connected,
  setRunning,
  run,
}: {
  currentFile: string;
  running: boolean;
  connected: boolean;
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
