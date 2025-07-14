'use-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
export function FileType({
  value = 'file',
  setValue,
}: {
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <div className="flex-none w-[100px] gap-1">
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger
          id="id-type-of-file"
          className="w-[100px] h-[40px] p-1 flex items-center justify-between border rounded-md dark"
        >
          <SelectValue placeholder="File ype" />
        </SelectTrigger>
        <SelectContent className="w-[100px] max-h-[100px] overflow-y-auto">
          <SelectItem value="file">File</SelectItem>
          <SelectItem value="folder">Folder</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
export function FileTyp1e({
  value = 'file',
  setValue,
}: {
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger id="id-type-of-file">
        <SelectValue placeholder="File type" />
      </SelectTrigger>
      <SelectContent className="flex w-100px">
        <SelectItem value="file">File</SelectItem>
        <SelectItem value="folder">Folder</SelectItem>
      </SelectContent>
    </Select>
  );
}
