"""Extract the first sheet of the Bodyweight Fitness Progressions chart. Stdlib only."""
import io
import itertools
import json
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {
    "o": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    "t": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    "x": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
    "s": "urn:oasis:names:tc:opendocument:xmlns:style:1.0",
    "fo": "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
    "h": "http://www.w3.org/1999/xlink",
}


def key(prefix, name):
    return "{%s}%s" % (NS[prefix], name)


def address(row, col):
    letters = ""
    while col:
        col, rem = divmod(col - 1, 26)
        letters = chr(65 + rem) + letters
    return letters + str(row)


def rich_text(el):
    if el.tag == key("x", "s"):
        return " " * int(el.get(key("x", "c"), 1))
    if el.tag == key("x", "tab"):
        return "\t"
    if el.tag == key("x", "line-break"):
        return "\n"
    return (el.text or "") + "".join(rich_text(ch) + (ch.tail or "") for ch in el)


def read_grid(sheet):
    grid, row_num = {}, 1
    for row in sheet.findall("t:table-row", NS):
        col_num = 1
        row_count = int(row.get(key("t", "number-rows-repeated"), 1))
        for cell in row:
            if cell.tag not in (key("t", "table-cell"), key("t", "covered-table-cell")):
                continue
            count = int(cell.get(key("t", "number-columns-repeated"), 1))
            paragraphs = cell.findall("x:p", NS)
            text = "\n".join(rich_text(p) for p in paragraphs)
            links = [{"label": rich_text(a), "url": a.attrib[key("h", "href")]}
                     for a in cell.findall(".//x:a", NS)]
            if (text or links) and (row_num + row_count - 1 > 60 or col_num + count - 1 > 112):
                raise ValueError("Unexpected content outside the supported chart at " + address(row_num, col_num))
            # ODS can represent the rest of a blank sheet with a single repetition.
            for r in range(row_num, min(61, row_num + row_count)):
                for c in range(col_num, min(113, col_num + count)):
                    grid[r, c] = (cell, text, links)
            col_num += count
        row_num += row_count
    return grid


def extract(workbook):
    with zipfile.ZipFile(io.BytesIO(workbook)) as ods:
        # Styles precede the spreadsheet. Stop reading as soon as its first
        # sheet closes, so later editions never participate in extraction.
        styles, sheet, in_spreadsheet = {}, None, False
        with ods.open("content.xml") as content:
            for event, el in ET.iterparse(content, events=("start", "end")):
                if event == "start" and el.tag == key("o", "spreadsheet"):
                    in_spreadsheet = True
                elif event == "end" and el.tag == key("s", "style") and not in_spreadsheet:
                    styles[el.get(key("s", "name"))] = {k: v for ch in el for k, v in ch.attrib.items()}
                elif event == "start" and in_spreadsheet and sheet is None and el.tag == key("t", "table"):
                    sheet = el
                elif event == "end" and el is sheet:
                    break
    if sheet is None:
        raise ValueError("No first sheet in workbook")
    grid = read_grid(sheet)

    def style(pos, prop):
        return styles.get(grid[pos][0].get(key("t", "style-name")), {}).get(key("fo", prop))

    def txt(r, c):
        return grid[r, c][1].strip()

    title = txt(2, 39)
    if title != "Bodyweight Fitness Progressions" or txt(45, 102) != "Legend":
        raise ValueError("First sheet does not match the Bodyweight Fitness Progressions chart layout")
    family_cols = [6, 22, 39, 55, 84, 103]
    families = [txt(5, c) for c in family_cols]
    if families != ["Horizontal Pull", "Vertical Pull", "Vertical Push", "Horizontal Push", "Core", "Legs"]:
        raise ValueError("Movement family headings changed")
    tier_rows = [48, 50, 52, 54]
    tiers = {style((r, c), "background-color"): txt(r, 102)
             for r in tier_rows for c in (109, 111)}
    milestone_ink = style((56, 109), "color")
    prerequisite_fill = style((59, 102), "background-color")
    # Two pale shades carry continuous lanes behind overflowing labels.
    lane_fills = set(tiers) | {"#e2efd9", "#d9e2f3"}
    entries, movement_cells, marked, highlighted = [], {}, {}, []
    covered_links = []

    def entry(r, c, kind, **details):
        _, raw, links = grid[r, c]
        item = {"cell": address(r, c), "kind": kind, "text": raw.strip(), **details}
        if links:
            item["links"] = links
            covered_links.extend((r, c, link) for link in links)
        entries.append(item)
        return item

    def body(r, c):
        return 7 <= r <= 51 and 1 <= c <= 111 and (r < 45 or c < 99)

    for (r, c), (cell, raw, links) in sorted(grid.items()):
        value = raw.strip()
        if not value:
            continue
        if body(r, c) and value not in ("•", "|", "―", "=") and not (c == 5 and 21 <= r <= 25):
            end = c + int(cell.get(key("t", "number-columns-spanned"), 1))
            candidates = [n for n in (c - 1, end) if (r, n) in grid and txt(r, n) == "•"]
            if len(candidates) == 2:
                candidates = [end if style((r, c), "text-align") == "end" else c - 1]
            if len(candidates) != 1:
                raise ValueError("Cannot locate the skill marker for " + address(r, c))
            marker = (r, candidates[0])
            if marker in marked:
                raise ValueError("Two skills claim the same marker at " + address(*marker))
            family = families[sum(c >= boundary for boundary in (22, 33, 55, 84, 99))]
            item = entry(r, c, "skill", family=family, difficulty=tiers[style(marker, "background-color")],
                         milestone=style(marker, "color") == milestone_ink)
            marked[marker] = item["cell"]
            movement_cells[item["cell"]] = item["text"]
            if style((r, c), "background-color") == prerequisite_fill:
                highlighted.append(item["cell"])
        elif r == 2 and links:
            entry(r, c, "warm_up")
        elif (r, c) == (3, 88):
            entry(r, c, "warm_up_note")
        elif r == 6 and value != "|":
            family = families[0 if c < 22 else 2 if c < 55 else 5]
            item = entry(r, c, "family_heading", detail=family)
            item["text"] = value.strip(" -")
        elif (r, c) == (21, 5):
            item = entry(r, c, "progression_note")
            item["text"] = " ".join(txt(n, c) for n in range(21, 26))
        elif 56 <= r <= 60 and c in (3, 15, 27, 39, 51):
            entry(r, c, "abbreviation", detail=txt(r, c + 3))
        elif 56 <= r <= 60 and c == 78:
            entry(r, c, "reference", detail=txt(r, 63))
        elif 56 <= r <= 60 and 89 <= c <= 99:
            entry(r, c, "workbook_note")

    # An '=' explicitly puts the same skill on two lanes in the same row.
    for (r, c), (_, raw, _) in grid.items():
        if body(r, c) and raw.strip() == "=":
            a, b = (r, c - 1), (r, c + 1)
            if txt(*a) != "•" or txt(*b) != "•" or ((a in marked) == (b in marked)):
                raise ValueError("Ambiguous shared marker at " + address(r, c))
            marked[a] = marked[b] = marked.get(a) or marked[b]

    dots = {pos for pos, (_, text, _) in grid.items() if body(*pos) and text.strip() == "•"}
    if dots != marked.keys():
        raise ValueError("Some chart markers have no matching skill")
    original_links = [(r, c, link) for (r, c), (_, _, links) in sorted(grid.items()) for link in links]
    if original_links != covered_links:
        raise ValueError("Some first-sheet hyperlinks have no matching entry")

    # At a horizontal junction, carry the last named skill on each incoming
    # lane to each outgoing lane. Gaps break paths. Parallel lanes stay separate.
    previous, edges = {}, set()
    for r in range(7, 52):
        columns = [c for c in range(1, 112) if body(r, c) and style((r, c), "background-color") in lane_fills]
        current = {}
        for _, run in itertools.groupby(enumerate(columns), lambda pair: pair[1] - pair[0]):
            lane = [c for _, c in run]
            upstream = set().union(*(previous.get(c, set()) for c in lane))
            targets = {marked[r, c] for c in lane if (r, c) in marked}
            if len(targets) > 1:
                raise ValueError("Ambiguous junction in row " + str(r))
            edges.update((a, b, "next_on_chart") for a in upstream for b in targets if a != b)
            current.update((c, targets or upstream) for c in lane)
        previous = current
    target, = [cell for cell in highlighted if movement_cells[cell] == "Iron Cross Progression"]
    edges.update((cell, target, "prerequisite") for cell in highlighted if cell != target)
    return {"format": "bodyweight-progression-sheet-v1", "key": "bodyweight-fitness-progressions",
            "sheet": sheet.attrib[key("t", "name")], "title": title, "edition": txt(4, 2),
            "families": families, "entries": entries,
            "edges": [{"from": a, "to": b, "kind": k} for a, b, k in sorted(edges)]}


if __name__ == "__main__":
    try:
        print(json.dumps(extract(sys.stdin.buffer.read()), ensure_ascii=True))
    except (ValueError, KeyError, zipfile.BadZipFile, ET.ParseError) as error:
        sys.exit("Could not read progression chart: " + str(error))
