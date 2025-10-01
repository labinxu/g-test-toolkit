'use client';
import { Button } from '@/components/ui/button';
import { FileNode } from './files/types';
import { Loader2Icon } from 'lucide-react';
export function Control({
  currentFile,
  running,
  connected,
  setRunning,
  run,
  buildCoreLib,
  buildCommonLib,
}: {
  currentFile: string;
  running: boolean;
  connected: boolean;
  setRunning?: (run: boolean) => void;
  run?: (path?: FileNode) => Promise<void>;
  buildCoreLib?: () => Promise<void>;
  buildCommonLib?: () => Promise<void>;
}) {
  return (
    <div className="flex justify-between items-center rounded-lg shadow-sm ">
      <div>
        {currentFile ? (
          <>
            {run ? (
              <Button
                variant={'outline'}
                size={'sm'}
                disabled={running}
                onClick={() => {
                  !running && run && run();
                  setRunning && setRunning(!running);
                }}
              >
                {!running ? '' : <Loader2Icon className="animate-spin" />}
                {!running ? 'Execute' : 'Running'}
              </Button>
            ) : null}
            {buildCoreLib ? (
              <Button variant={'outline'} size={'sm'} onClick={buildCoreLib}>
                Corelib
              </Button>
            ) : null}
            {buildCommonLib ? (
              <Button variant={'outline'} size={'sm'} onClick={buildCommonLib}>
                Gettrlib
              </Button>
            ) : null}
          </>
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
