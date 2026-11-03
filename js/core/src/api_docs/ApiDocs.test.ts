import { afterEach, assert, beforeEach, test, vi } from "vitest";
import { mount, tick, unmount, type ComponentProps } from "svelte";
import ApiDocs from "./ApiDocs.svelte";

let target: HTMLDivElement;
let component: ReturnType<typeof mount> | undefined;

beforeEach(() => {
	target = document.body.appendChild(document.createElement("div"));
	history.replaceState(null, "", "?lang=mcp");
});

afterEach(async () => {
	if (component) await unmount(component);
	component = undefined;
	target.remove();
	vi.restoreAllMocks();
});

test.each([[], ["x-demo-key"]])(
	"keeps a pinned stdio fallback and required headers: %j",
	async (...headers: string[]) => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			const body = url.endsWith("/mcp/schema")
				? [
						{
							name: "greet",
							description: "Return a greeting",
							inputSchema: { properties: {} },
							meta: {
								headers,
								mcp_type: "tool",
								file_data_present: false,
								endpoint_name: "greet"
							}
						}
					]
				: url.endsWith("/info")
					? { named_endpoints: {}, unnamed_endpoints: {} }
					: { functions: {} };
			return new Response(JSON.stringify(body));
		});
		component = mount(ApiDocs, {
			target,
			props: {
				dependencies: [
					{ id: 0, api_name: "greet", api_visibility: "public" }
				] as ComponentProps<typeof ApiDocs>["dependencies"],
				root: "https://example.com/",
				app: {
					api_prefix: "/gradio_api",
					view_api: async () => ({
						named_endpoints: {},
						unnamed_endpoints: {}
					})
				} as ComponentProps<typeof ApiDocs>["app"],
				space_id: null,
				root_node: {} as ComponentProps<typeof ApiDocs>["root_node"],
				username: null
			}
		});
		await vi.waitFor(() => {
			assert.include(target.textContent, "mcp-remote@0.16.0");
		});
		const stdio = Array.from(target.querySelectorAll("button")).find(
			(button) => button.textContent?.trim() === "STDIO"
		);
		assert.exists(stdio);
		stdio!.click();
		await tick();
		assert.notInclude(target.textContent, "e.g. Claude Desktop");
		const snippet = Array.from(target.querySelectorAll("pre"))
			.map((pre) => pre.textContent || "")
			.find((text) => text.includes("mcp-remote@0.16.0"));
		assert.exists(snippet);
		const config = JSON.parse(snippet!);
		assert.deepEqual(config.mcpServers.gradio.args, [
			"mcp-remote@0.16.0",
			"https://example.com/gradio_api/mcp/",
			"--transport",
			"http-only",
			...headers.flatMap((header) => [
				"--header",
				`${header}: <YOUR_HEADER_VALUE>`
			])
		]);
	}
);
