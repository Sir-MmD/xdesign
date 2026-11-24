// The most common passwords that are 10 characters or longer (shorter ones are refused anyway),
// from the published lists of leaked passwords, in lower case: a new password that matches one,
// ignoring case, is refused (docs/plan/02-architecture.md section 8 item 2).
const list = `
0000000000 0123456789 0987654321 1029384756 1111111111 1122334455 11223344556 1212121212
1231231231 123123123123 1234512345 123456123456 1234554321 1234567890 1234567890123
1234567890a 1234567890q 12345678901 12345678910 1234567891 123456789a 123456789q 1234qwerasdf
1357924680 147258369147 1q2w3e4r5t 1q2w3e4r5t! 1q2w3e4r5t6y 1qaz2wsx1qaz 1qaz2wsx3edc
1qazxsw23edc 2222222222 2468013579 5555555555 7777777777 9876543210 9999999999 !q2w3e4r5t
!qaz2wsx3edc a123456789 a1234567890 a1b2c3d4e5 aa12345678 abc123abc123 abc1234567 abcd123456
abcdefg123 abcdefghij abcdefghijk abcdefghijkl abcdefghijklmnop admin123456 admin1234567
admin12345 admin@123456 adminadmin adminadmin123 administrator administrator1 arsenal123
asd123asd123 asdf1234asdf asdfasdfasdf asdfghjkl1 asdfghjkl123 autumn2025 barcelona1
barcelona123 baseball123 basketball basketball1 basketball123 batman12345 changeme123
changeme1234 changemenow charlie123 chelsea123 christmas1 christmas123 computer12 computer123
december12 default123 dragon12345 facebook123 football12 football123 football1234 fortnite123
goodmorning google1234 hello12345 hello123456 helloworld helloworld1 hockey12345 iloveyou!!
iloveyou12 iloveyou123 iloveyou1234 iloveyouforever instagram1 instagram123 internet123
iphone1234 jennifer123 jessica123 jordan2323 letmein123 letmein1234 letmeinnow liverpool1
liverpool123 loveyou123 manchester manchester1 master12345 michael123 minecraft1 minecraft123
monkey12345 mypassword mypassword1 mypassword123 newpassword newpassword1 newpassword123
nopassword p@55w0rd123 p@ssw0rd123 p@ssword123 pa55word123 passw0rd123 password!123 password01
password1! password12 password123 password123! password1234 password12345 password123456
password2020 password2021 password2022 password2023 password2024 password2025 password2026
passwordpassword pokemon123 princess12 princess123 q1w2e3r4t5 q1w2e3r4t5y6 q1w2e3r4t5y6u7
qazwsxedc123 qazwsxedcrfv qwe123qwe123 qwerasdfzxcv qwerty123! qwerty1234 qwerty12345
qwerty123456 qwertyqwerty qwertyuiop qwertyuiop1 qwertyuiop123 qwertyuiopasdfghjkl realmadrid
root123456 rootroot123 samsung123 secretpassword september1 shadow12345 soccer12345 spiderman1
spiderman123 spring2025 starwars123 summer2024 summer2025 summer2026 sunshine12 sunshine123
superman123 telegram123 thankyou123 trustno1234 welcome123 welcome1234 welcome2024 welcome2025
welcome2026 welcometoo whatever123 winter2024 winter2025 winter2026 yourpassword zaq12wsxcde3
zaq1zaq1zaq1 zxc123zxc123 zxcvbnm123 zxcvbnm1234 zxcvbnmasdfghjkl
`

export const commonPasswords: ReadonlySet<string> = new Set(list.trim().split(/\s+/))
