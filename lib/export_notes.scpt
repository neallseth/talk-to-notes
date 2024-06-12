-- Function to sanitize file names
on sanitizeFileName(theText)
    set illegalCharacters to {":", "/", "\\", "|", "?", "*", "<", ">", "\""}
    repeat with each in illegalCharacters
        set AppleScript's text item delimiters to each
        set theText to text items of theText
        set AppleScript's text item delimiters to "_"
        set theText to theText as text
    end repeat
    return theText
end sanitizeFileName

-- Function to format date
on formatDate(theDate)
    set {year:y, month:m, day:d, weekday:w} to theDate
    set monthName to (m as string)
    set dayName to (w as string)
    return dayName & ", " & monthName & " " & d & ", " & y
end formatDate

-- Main script
on run {exportFolder}
    tell application "Notes"
        try
            do shell script "echo Starting the note export process. >&2"
            
            -- Create a folder to store the exported notes
            do shell script "mkdir -p " & quoted form of POSIX path of exportFolder
            do shell script "echo Created export folder at " & quoted form of (POSIX path of exportFolder) & " >&2"
            
            set totalNotes to 0
            set exportedNotes to 0

            -- Loop through each account
            repeat with theAccount in accounts
                set accountName to name of theAccount as string
                do shell script "echo Processing account: " & quoted form of accountName & " >&2"
                
                -- Loop through each folder in the account
                repeat with theFolder in folders of theAccount
                    set folderName to name of theFolder as string
                    do shell script "echo Processing folder: " & quoted form of folderName & " >&2"
                    
                    -- Create a subfolder for each folder in Notes
                    set sanitizedFolderName to my sanitizeFileName(folderName)
                    set folderPath to exportFolder & "/" & sanitizedFolderName
                    do shell script "mkdir -p " & quoted form of POSIX path of folderPath
                    do shell script "echo Created folder path: " & quoted form of folderPath & " >&2"
                    
                    -- Loop through each note in the folder
                    repeat with theNote in notes of theFolder
                        set totalNotes to totalNotes + 1
                        set noteTitle to name of theNote as string
                        set sanitizedTitle to my sanitizeFileName(noteTitle)
                        set noteModificationDate to modification date of theNote
                        set formattedDate to my formatDate(noteModificationDate)
                        set noteBody to body of theNote as text

                        -- Create a text file with the note's title and date
                        set noteFilePath to folderPath & "/" & sanitizedTitle & " -- " & formattedDate & ".txt"
                        
                        -- Open the file for writing
                        try
                            do shell script "echo Writing note to file: " & quoted form of (POSIX path of noteFilePath) & " >&2"
                            set noteFileReference to open for access file (POSIX file noteFilePath as text) with write permission
                            -- Write to the file
                            write noteBody to noteFileReference as «class utf8»
                            close access noteFileReference
                            set exportedNotes to exportedNotes + 1
                        on error writeErrMsg number writeErrNum
                            do shell script "echo Error writing to file: " & quoted form of writeErrMsg & " (" & writeErrNum & ") >&2"
                        end try
                    end repeat
                end repeat
            end repeat
            
            -- Log the number of exported notes
            do shell script "echo Successfully exported " & exportedNotes & " out of " & totalNotes & " notes. >&2"
            
            -- Return the number of exported notes
            return exportedNotes
            
        on error mainErrMsg number mainErrNum
            do shell script "echo Main error: " & quoted form of mainErrMsg & " (" & mainErrNum & ") >&2"
            return -1 -- Return -1 in case of error
        end try
    end tell
end run
