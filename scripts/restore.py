
import os, re
log_path = os.path.join("C:", os.sep, "Users", "moong", ".gemini", "antigravity", "brain", "5c03e8a8-82f4-4f2d-80c3-f484bafe5f8e", ".system_generated", "logs", "overview.txt")
with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

matches = list(re.finditer(r"\[diff_block_start\](.*?)\[diff_block_end\]", text, re.DOTALL))
if matches:
    last_diff = matches[-1].group(1)
    
    old_lines = []
    for line in last_diff.split("\n"):
        if line.startswith("-"):
            old_lines.append(line[1:])
            
    if len(old_lines) > 500:
        with open("C:/Users/moong/Desktop/harin/web/donate.html", "w", encoding="utf-8") as f:
            f.write("\n".join(old_lines))
        print("Restored successfully! Lines:", len(old_lines))
    else:
        print("Diff parsing failed, old_lines length:", len(old_lines))
else:
    print("Diff block not found")

