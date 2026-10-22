package sitesync

// CUSTOM: LatinBoyz post titles are mostly generic phrases around the model
// names ("Gay Latino Porn GABRIEL and CYCO", "ROLO… Big thick Latin dicks",
// "Cute Latino Twink – Brian"). lbzCleanTitle keeps only the names.

import (
	"regexp"
	"strings"
	"unicode"
)

var (
	lbzGeneric = lbzWordSet(`gay latin latino latinos latina latins twink twinks porn nude naked men man guy guys boy boys boyz boi
sex video videos bareback raw fuck fucks fucking fucked cock cocks dick dicks hot cute big huge thick young teen teens
mexican colombian puerto rican chilean cuban brazilian guatemalan blatino hombres action uncut monster hung sexy horny
bisexual bi curious latinboyz latinboyz.com bilatin model models vintage flip flop flob papi papis amateur hard bodies
body ass perfect curved veiny kinky versatile masculine smooth broke straight tatted foreskin mucho skinny
three way threesome latinboy bubble butt fantasy`)
	// Words that are never a name on their own, though "HUGO & HIS CURIOUS
	// NEIGHBOR" keeps them next to one.
	lbzNotName  = lbzWordSet(`his bitch friend`)
	lbzStop     = lbzWordSet(`on with the for of this a and & in by to is gets get`)
	lbzAcronyms = lbzWordSet(`HD BBC XXX POV DP USA NSFW MP4 OK`)

	lbzTokenRE      = regexp.MustCompile(`[^\s,&()]+|[,&]`)
	lbzWordRE       = regexp.MustCompile(`[a-z.]+`)
	lbzPossessiveRE = regexp.MustCompile(`['’][sS]$`)
	lbzEllipsisRE   = regexp.MustCompile(`^(.*?)\s*(?:…|\.\.\.)`)
	lbzDashRE       = regexp.MustCompile(`\s[-–—]\s?|[–—]\s`)
	lbzSiteNameRE   = regexp.MustCompile(`(?i)\blatinboyz(?:\.com)?(?: models?)?\b`)
	lbzListSepRE    = regexp.MustCompile(`\s*(?:,|&|\band\b|\bAND\b)\s*`)
	lbzAndRE        = regexp.MustCompile(`\s+and\s+`)
	lbzFileTitleRE  = regexp.MustCompile(`(?i)^(?:am|hd)?\d+(?:\.mp4)?$`)
	lbzInitialRE    = regexp.MustCompile(`^[A-Z]$`)
)

const lbzTokenTrim = ".:!?\"'…"

func lbzWordSet(words string) map[string]bool {
	set := map[string]bool{}
	for _, w := range strings.Fields(words) {
		set[w] = true
	}
	return set
}

// lbzCleanTitle returns the model names in a post title, joined as "A, B
// & C", or "" when the title names nobody.
func lbzCleanTitle(title string) string {
	t := strings.TrimSpace(title)
	if t == "" || lbzFileTitleRE.MatchString(t) {
		return ""
	}
	// NAMES… description
	if m := lbzEllipsisRE.FindStringSubmatch(t); m != nil && strings.TrimSpace(m[1]) != "" && lbzGenericCount(m[1]) <= 1 {
		return lbzJoin(lbzSplitList(m[1]))
	}
	// generic – Names, or Names – generic
	if loc := lbzDashRE.FindStringIndex(t); loc != nil {
		left, right := t[:loc[0]], t[loc[1]:]
		side := right
		if lbzGenericCount(left) < lbzGenericCount(right) {
			side = left
		}
		return lbzJoin(lbzSplitList(side))
	}
	if names := lbzCapsNames(t); len(names) > 0 {
		return lbzJoin(names)
	}
	if lbzGenericCount(t) >= 2 {
		return lbzJoin(lbzLeftoverNames(t))
	}
	return lbzAndRE.ReplaceAllString(t, " & ")
}

func lbzGenericCount(text string) int {
	n := 0
	for _, w := range lbzWordRE.FindAllString(strings.ToLower(text), -1) {
		if lbzGeneric[w] {
			n++
		}
	}
	return n
}

func lbzIsConnector(tok string) bool {
	return tok == "AND" || tok == "&" || tok == ","
}

// lbzIsCaps accepts names written in capitals, allowing one lowercase slip
// in longer ones ("LUCkY").
func lbzIsCaps(tok string) bool {
	var letters, lower int
	first := true
	for _, r := range tok {
		if !unicode.IsLetter(r) {
			continue
		}
		if first && !unicode.IsUpper(r) {
			return false
		}
		first = false
		letters++
		if unicode.IsLower(r) {
			lower++
		}
	}
	if letters < 2 || lbzAcronyms[strings.ToUpper(tok)] || lbzIsConnector(tok) {
		return false
	}
	return lower == 0 || (lower == 1 && letters >= 4)
}

// lbzCap turns "C-LO" into "C-Lo"; two-letter names (BJ, JD) stay capitals
// and mixed-case names (iNFAMOUSj, JoJo) stay as written.
func lbzCap(word string) string {
	word = lbzPossessiveRE.ReplaceAllString(word, "")
	var letters, lower int
	for _, r := range word {
		if unicode.IsLetter(r) {
			letters++
		}
		if unicode.IsLower(r) {
			lower++
		}
	}
	if lower > 1 {
		return word
	}
	if letters <= 2 {
		return strings.ToUpper(word)
	}
	runes := []rune(strings.ToLower(word))
	for i, r := range runes {
		if i == 0 || runes[i-1] == '-' || unicode.IsSpace(runes[i-1]) {
			runes[i] = unicode.ToUpper(r)
		}
	}
	return string(runes)
}

func lbzAllGeneric(name string) bool {
	for _, w := range strings.Fields(strings.ToLower(name)) {
		if !lbzGeneric[w] && !lbzNotName[w] && !lbzStop[w] {
			return false
		}
	}
	return true
}

func lbzJoin(names []string) string {
	var uniq []string
	seen := map[string]bool{}
	for _, n := range names {
		if n = strings.TrimSpace(n); n != "" && !seen[n] {
			seen[n] = true
			uniq = append(uniq, n)
		}
	}
	switch len(uniq) {
	case 0:
		return ""
	case 1:
		return uniq[0]
	}
	return strings.Join(uniq[:len(uniq)-1], ", ") + " & " + uniq[len(uniq)-1]
}

// lbzCapsNames reads runs of capitalized words as names; a single capital
// letter belongs to the name next to it ("JAE G", "G BOY").
func lbzCapsNames(text string) []string {
	var toks []string
	for _, tok := range lbzTokenRE.FindAllString(text, -1) {
		toks = append(toks, strings.Trim(tok, lbzTokenTrim))
	}
	var names, cur []string
	flush := func() {
		if len(cur) > 0 {
			if name := strings.Join(cur, " "); !lbzAllGeneric(name) {
				names = append(names, name)
			}
		}
		cur = nil
	}
	for i, tok := range toks {
		next := ""
		if i+1 < len(toks) {
			next = toks[i+1]
		}
		switch {
		case tok != "" && lbzIsCaps(tok):
			cur = append(cur, lbzCap(tok))
		case lbzInitialRE.MatchString(tok) && (len(cur) > 0 || lbzIsCaps(next)):
			cur = append(cur, tok)
		default:
			flush()
		}
	}
	flush()
	return names
}

// lbzSplitList reads a plain name list such as "Gio & Pablito" or
// "Bernardo & Agustin Latinboyz Models".
func lbzSplitList(text string) []string {
	text = lbzSiteNameRE.ReplaceAllString(text, " ")
	var names []string
	for _, part := range lbzListSepRE.Split(text, -1) {
		words := strings.Fields(strings.Trim(part, " ."))
		for len(words) > 0 && lbzGeneric[strings.ToLower(words[0])] {
			words = words[1:]
		}
		p := strings.Join(words, " ")
		if p == "" || lbzAllGeneric(p) {
			continue
		}
		if p == strings.ToUpper(p) && p != strings.ToLower(p) {
			names = append(names, lbzCap(p))
		} else {
			names = append(names, lbzPossessiveRE.ReplaceAllString(p, ""))
		}
	}
	return names
}

// lbzLeftoverNames reads mixed-case titles such as "Huge Curved Latin Cock
// on Lleno": what is left after the generic and filler words is the names.
func lbzLeftoverNames(text string) []string {
	var names, cur []string
	flush := func() {
		if len(cur) > 0 {
			names = append(names, strings.Join(cur, " "))
		}
		cur = nil
	}
	for _, tok := range lbzTokenRE.FindAllString(text, -1) {
		w := strings.Trim(tok, lbzTokenTrim)
		low := strings.ToLower(w)
		r := []rune(w)
		if w == "" || lbzGeneric[low] || lbzStop[low] || lbzIsConnector(tok) || !unicode.IsUpper(r[0]) {
			flush()
			continue
		}
		cur = append(cur, lbzPossessiveRE.ReplaceAllString(w, ""))
	}
	flush()
	return names
}
