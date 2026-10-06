-- Export incomplete Things 3 Work-area todos from Inbox / Today / Anytime as JSON.
-- Shape: { "items": [{ title, notes, tags, when, deadline, project, waitingOn?, promisedTo? }] }
-- Skips Logbook / completed. Someday-tagged items get Park via tags.

on run
	set jsonText to my exportWorkJSON()
	return jsonText
end run

on exportWorkJSON()
	tell application "Things3"
		set collected to {}
		set listNames to {"Inbox", "Today", "Anytime"}
		repeat with listName in listNames
			set listName to listName as text
			set theTodos to to dos of list listName
			repeat with aToDo in theTodos
				try
					set tstatus to (status of aToDo) as text
					if tstatus is not "open" then
						-- skip completed / canceled
					else
						set areaName to my areaNameOf(aToDo)
						if my isWorkArea(areaName) then
							set end of collected to my todoToRecord(aToDo, areaName)
						end if
					end if
				end try
			end repeat
		end repeat
	end tell
	
	set parts to {}
	repeat with rec in collected
		set end of parts to my recordToJSON(rec)
	end repeat
	
	set astid to AppleScript's text item delimiters
	set AppleScript's text item delimiters to "," & linefeed
	set body to parts as text
	set AppleScript's text item delimiters to astid
	return "{" & linefeed & "  \"items\": [" & linefeed & body & linefeed & "  ]" & linefeed & "}"
end exportWorkJSON

on areaNameOf(aToDo)
	tell application "Things3"
		try
			set p to project of aToDo
			if p is missing value then return ""
			try
				set a to area of p
				if a is missing value then return ""
				return name of a as text
			end try
			return ""
		end try
	end tell
	return ""
end areaNameOf

on isWorkArea(areaName)
	set n to my lowerText(areaName)
	if n is "work" then return true
	if n starts with "work " then return true
	if n ends with " work" then return true
	-- Cyrillic / alias used in vault notes
	if n is "работа" then return true
	return false
end isWorkArea

on todoToRecord(aToDo, areaName)
	tell application "Things3"
		set tname to name of aToDo as text
		set ttags to ""
		try
			set ttags to tag names of aToDo as text
		end try
		set tnotes to ""
		try
			set tnotes to notes of aToDo as text
		end try
		set tdeadline to ""
		try
			set d to due date of aToDo
			if d is not missing value then set tdeadline to my fmtDate(d)
		end try
		set twhen to ""
		try
			set a to activation date of aToDo
			if a is not missing value then set twhen to my fmtDate(a)
		end try
		set tproject to ""
		try
			set p to project of aToDo
			if p is not missing value then set tproject to name of p as text
		end try
		if tproject is "" and areaName is not "" then set tproject to areaName
	end tell
	
	set tagList to my splitTags(ttags)
	-- Someday list items are not exported; if tag Someday present → keep as Park tag
	return {title:tname, notes:tnotes, tags:tagList, whenDate:twhen, deadline:tdeadline, project:tproject}
end todoToRecord

on splitTags(tagStr)
	set out to {}
	if tagStr is "" then return out
	set astid to AppleScript's text item delimiters
	set AppleScript's text item delimiters to {", "}
	set parts to text items of tagStr
	set AppleScript's text item delimiters to astid
	repeat with p in parts
		set t to my trim(p as text)
		if t is not "" then set end of out to t
	end repeat
	return out
end splitTags

on recordToJSON(rec)
	set titleJ to my jsonString(title of rec)
	set notesJ to my jsonString(notes of rec)
	set whenJ to my jsonString(whenDate of rec)
	set deadJ to my jsonString(deadline of rec)
	set projJ to my jsonString(project of rec)
	set tagsJ to my jsonStringArray(tags of rec)
	return "    {" & linefeed & ¬
		"      \"title\": " & titleJ & "," & linefeed & ¬
		"      \"notes\": " & notesJ & "," & linefeed & ¬
		"      \"tags\": " & tagsJ & "," & linefeed & ¬
		"      \"when\": " & whenJ & "," & linefeed & ¬
		"      \"deadline\": " & deadJ & "," & linefeed & ¬
		"      \"project\": " & projJ & linefeed & ¬
		"    }"
end recordToJSON

on jsonStringArray(lst)
	set parts to {}
	repeat with t in lst
		set end of parts to my jsonString(t as text)
	end repeat
	set astid to AppleScript's text item delimiters
	set AppleScript's text item delimiters to ", "
	set body to parts as text
	set AppleScript's text item delimiters to astid
	return "[" & body & "]"
end jsonStringArray

on jsonString(s)
	set t to s as text
	if t is "" then return "null"
	set t to my replaceText(t, "\\", "\\\\")
	set t to my replaceText(t, "\"", "\\\"")
	set t to my replaceText(t, return, "\\n")
	set t to my replaceText(t, linefeed, "\\n")
	set t to my replaceText(t, tab, "\\t")
	return "\"" & t & "\""
end jsonString

on fmtDate(d)
	set y to year of d as integer
	set m to month of d as integer
	set dy to day of d as integer
	return (y as text) & "-" & my pad2(m) & "-" & my pad2(dy)
end fmtDate

on pad2(n)
	if n < 10 then return "0" & (n as text)
	return n as text
end pad2

on lowerText(s)
	set t to s as text
	considering case
		-- AppleScript has no built-in lower; use shell for reliability on unicode
	end considering
	try
		return do shell script "printf %s " & quoted form of t & " | tr '[:upper:]' '[:lower:]'"
	end try
	return t
end lowerText

on trim(s)
	set t to s as text
	repeat while t starts with " "
		set t to text 2 thru -1 of t
		if t is "" then return ""
	end repeat
	repeat while t ends with " "
		if (length of t) < 2 then return ""
		set t to text 1 thru -2 of t
	end repeat
	return t
end trim

on replaceText(theText, findText, replaceWith)
	set astid to AppleScript's text item delimiters
	set AppleScript's text item delimiters to findText
	set parts to text items of theText
	set AppleScript's text item delimiters to replaceWith
	set outText to parts as text
	set AppleScript's text item delimiters to astid
	return outText
end replaceText
