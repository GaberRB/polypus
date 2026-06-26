import { describe, expect, it } from "vitest";
import { parseEmulatedToolCalls } from "../src/core/protocol/parser.js";

describe("parseEmulatedToolCalls", () => {
  it("parses a single tool call with multiple args", () => {
    const out = `Sure, I'll do that.
<polypus:tool name="write_file">
<arg name="path">src/index.ts</arg>
<arg name="content">console.log("hi");</arg>
</polypus:tool>`;
    const { toolCalls, text } = parseEmulatedToolCalls(out);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.name).toBe("write_file");
    expect(toolCalls[0]!.arguments).toEqual({
      path: "src/index.ts",
      content: 'console.log("hi");',
    });
    expect(text).toBe("Sure, I'll do that.");
  });

  it("tolerates single-quoted and unquoted name attributes", () => {
    const single = parseEmulatedToolCalls(
      `<polypus:tool name='read_file'><arg name='path'>a.ts</arg></polypus:tool>`,
    );
    expect(single.toolCalls[0]!.name).toBe("read_file");
    expect(single.toolCalls[0]!.arguments).toEqual({ path: "a.ts" });

    const bare = parseEmulatedToolCalls(
      `<polypus:tool name=list_dir><arg name=path>src</arg></polypus:tool>`,
    );
    expect(bare.toolCalls[0]!.name).toBe("list_dir");
    expect(bare.toolCalls[0]!.arguments).toEqual({ path: "src" });
  });

  it("preserves angle brackets inside code content", () => {
    const out = `<polypus:tool name="write_file">
<arg name="path">a.tsx</arg>
<arg name="content">const x = <div>{a < b ? 1 : 2}</div>;</arg>
</polypus:tool>`;
    const { toolCalls } = parseEmulatedToolCalls(out);
    expect(toolCalls[0]!.arguments.content).toBe("const x = <div>{a < b ? 1 : 2}</div>;");
  });

  it("parses multiple tool calls in one output", () => {
    const out = `<polypus:tool name="read_file"><arg name="path">a.ts</arg></polypus:tool>
<polypus:tool name="finish"><arg name="summary">done</arg></polypus:tool>`;
    const { toolCalls } = parseEmulatedToolCalls(out);
    expect(toolCalls.map((t) => t.name)).toEqual(["read_file", "finish"]);
    expect(toolCalls[1]!.arguments.summary).toBe("done");
  });

  it("returns no tool calls for plain prose", () => {
    const { toolCalls, text } = parseEmulatedToolCalls("I cannot create files.");
    expect(toolCalls).toHaveLength(0);
    expect(text).toBe("I cannot create files.");
  });

  it("tolerates an unterminated tool block", () => {
    const out = `<polypus:tool name="write_file"><arg name="path">a.ts</arg>`;
    const { toolCalls } = parseEmulatedToolCalls(out);
    expect(toolCalls).toHaveLength(0);
  });

  it("recognizes the <toolName> shorthand for known tools", () => {
    const out = `Done.
<finish><arg name="summary">created the file</arg></finish>`;
    const { toolCalls } = parseEmulatedToolCalls(out, ["finish", "write_file"]);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.name).toBe("finish");
    expect(toolCalls[0]!.arguments.summary).toBe("created the file");
  });

  it("recognizes the `name:` label form followed by arg blocks", () => {
    const out = `finish:
  <arg name="summary">Created greeting.txt.</arg>
</polypus:tool>`;
    const { toolCalls } = parseEmulatedToolCalls(out, ["finish", "write_file"]);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.name).toBe("finish");
    expect(toolCalls[0]!.arguments.summary).toBe("Created greeting.txt.");
  });

  it("ignores shorthand tags that are not known tool names", () => {
    const out = "Wrap it in a <div>element</div> please.";
    const { toolCalls } = parseEmulatedToolCalls(out, ["finish", "write_file"]);
    expect(toolCalls).toHaveLength(0);
  });

  it("strips a single leading/trailing newline from block values", () => {
    const out = `<polypus:tool name="write_file">
<arg name="content">
line1
line2
</arg>
</polypus:tool>`;
    const { toolCalls } = parseEmulatedToolCalls(out);
    expect(toolCalls[0]!.arguments.content).toBe("line1\nline2");
  });
});
