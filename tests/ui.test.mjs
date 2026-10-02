import test from 'node:test';import {execFileSync} from 'node:child_process';
// The WebGL merge game is covered by merge.test.mjs and merge-browser.mjs.
for(const id of ['sudoku','words','mahjong','chess','checkers','corners','durak','klondike','spider','tricks'])test(`DOM integration: ${id}`,()=>{execFileSync(process.execPath,['tests/dom-run.mjs',id],{cwd:process.cwd(),timeout:7000,stdio:'pipe'});});
