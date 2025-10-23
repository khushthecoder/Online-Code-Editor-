import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { okaidia } from '@uiw/codemirror-theme-okaidia';

const Editor = ({ language, value, onChange }) => {
  
  const getLanguageExtension = () => {
    switch (language) {
      case 'javascript':
        return javascript({ jsx: true });
      case 'html':
        return html();
      case 'css':
        return css();
      default:
        return javascript({ jsx: true });
    }
  };

  const handleChange = React.useCallback((val, viewUpdate) => {
    onChange(val);
  }, [onChange]);

  return (
    <CodeMirror
      value={value}
      height="22vh" 
      theme={okaidia}
      extensions={[getLanguageExtension()]}
      onChange={handleChange}
      options={{ 
        lint: true,
        lineNumbers: true,
      }}
    />
  );
};

export default Editor;