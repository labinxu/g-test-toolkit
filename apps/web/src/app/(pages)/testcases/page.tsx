'use client';

import { useCallback,useEffect, useState , useRef} from 'react';
import ts from 'typescript';
import {useQuery} from '@tanstack/react-query';

import Editor,{ OnMount } from '@monaco-editor/react';

import type { Monaco } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
const INITIAL_CODE = '//Test Case';
const headers = { "Content-Type": "application/json" };

const Page: React.FC = () => {
  const [code, setCode] = useState<string>(INITIAL_CODE);
  const [testCase,setTestCase] = useState<string>('');
   const monacoRef = useRef<Monaco>(null);

  const testcaseQuery = useQuery({
    queryKey: ["init"],
    queryFn: () =>
      fetch(`/api/testcase/init`, {
        method: "GET",
        //credentials: "include",
        headers: { ...headers },
      }).then((res) => {
        if (res.ok) {
          return res.json();
        }
      }),
  });
  useEffect(() => {
    if (testcaseQuery.isPending) return;
    const { content} = testcaseQuery.data;
    setTestCase(content);
    console.log(content)
  }, [testcaseQuery]);
  useEffect(()=>{
    if(testCase!==''){
      monacoRef.current?.languages.typescript.typescriptDefaults.addExtraLib(
            testCase,
            "file:///node_modules/@types/test-case.d.ts"
          );
    }
  },[testCase])
  const transpile = useCallback(()=>{
    const result = ts.transpileModule(code, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2017}})
    return result.outputText;
  },[code]);

  // 编辑器挂载时初始化
  const handleEditorDidMount: OnMount = useCallback(
    (editor, monaco: Monaco) => {
      if (!monaco) return;
      monacoRef.current = monaco;

      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        'declare module "my-module" { export function myFunc(): void; }',
        'my-module.d.ts'
      );
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        typeRoots: ['node_modules/@types'],
      });
    },
    []
  );
  const run = async () => {
    const res = await fetch('/api/testcase/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code}),
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  }
  // 编辑器内容变化
  const handleEditorChange = useCallback(
    (value?: string) => {
      setCode(value ?? '');
    },
    []
  );

  return (
    <div>
    <Editor
      height="500px"
      language="typescript"
      value={code}
      onChange={handleEditorChange}
      onMount={handleEditorDidMount}
      options={{
        minimap: { enabled: false },
        fontSize: 16,
      }}
    />
      <Button onClick={run} >Run</Button>
    </div>
  );
};

export default Page;
