/** An error a user can act on: what went wrong, and the command or step that fixes it (INV-12). */
export interface ToolError {
	code: string;
	message: string;
	fix: string;
}
