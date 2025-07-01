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
      <div className="flex items-center gap-2 ">
        <Label htmlFor="run-in-browser" className="mr-2">
          BROWSER
        </Label>
        <Switch
          id="run-in-browser"
          checked={useBrowser}
          onCheckedChange={setUseBrowser}
        />
      </div>
      <div className="flex items-center gap-2 ">
        <Label htmlFor="run-in-browser" className="mr-2">
          MOBILE
        </Label>
        <Switch
          id="use-mobile"
          checked={useMobile}
          onCheckedChange={setUseMobile}
        />
      </div>

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
      <div className="flex flex-row gap-3">
        <strong>Server Status:</strong>{' '}
        <span style={{ color: connected ? 'green' : 'red' }}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </div>
  );
}
