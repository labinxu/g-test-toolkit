'use client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function FileType({
  value,
  setValue,
}: {
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <Select onValueChange={setValue} defaultValue={value}>
      <SelectTrigger
        id="id-type-of-file"
        className="w-[100px] h-[40px] p-1 flex items-center justify-between border rounded-md dark"
      >
        <SelectValue placeholder="Select" />
      </SelectTrigger>
      <SelectContent className="w-[100px] max-h-[100px] overflow-y-auto">
        <SelectItem value="file">File</SelectItem>
        <SelectItem value="folder">Folder</SelectItem>
      </SelectContent>
    </Select>
  );
}
