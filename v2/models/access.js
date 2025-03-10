var sportsman = require('../../api/sportsman');
var settings = require('../../settings');
var logger = require('../../logger');
var Season = require('./season');

var db = require('./db');

const easyCoachRoles = {
    "37": "2",
    "39": "1",
    "40": "3",
}

const easyCoachPermissions = {
    "37": "0",
    "39": "31",
    "40": "20",
}

function formatDate(date) {
    const pad = (n) => n.toString().padStart(2, '0'); // Ensures two-digit format
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1); // Months are zero-indexed
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
  
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

function encode_to_bin(rawValue) {
    const ENCODING_BITS = 16;
    const CAESAR_ZERO_COUNT = "a";
    const CAESAR_DIVERSION = 3;

    function PadLeft(input, count, char) {
        let paddedString = input + "";
        while (paddedString.length < count) paddedString = char + paddedString;
        return paddedString;
    }

    function ReverseString(str) {
        let result = "";
        for (let i = str.length - 1; i >= 0; i--) {
            result += str[i];
        }
        return result;
    }

    function IntToBinary(num, digits) {
        let result = "";
        let tmp = num;
        if (num <= 0) return "0";
        while (tmp > 0) {
            result += tmp % 2 === 0 ? "0" : "1";
            tmp = parseInt(tmp / 2, 10);
        }
        return PadLeft(ReverseString(result), digits, "0");
    }

    function CharToBinary(c, digitsCount) {
        if (c && c.length > 0) {
            const decValue = c.charCodeAt(0);
            return IntToBinary(decValue, digitsCount);
        }
        return "";
    }

    function Scramble(str) {
        let result = "";
        for (let i = 0; i < str.length; i++) {
            // String.fromCharCode
            result += str[(i + CAESAR_DIVERSION) % str.length];
        }
        return result;
    }

    if (rawValue == null || rawValue.length === 0) {
        return "";
    }
    let result;
    let arrBinChars = [""];
    let curPart = "";
    let minZeroCount = ENCODING_BITS;
    for (let i = 0; i < rawValue.length; i++) {
        arrBinChars.push(CharToBinary(rawValue[i], ENCODING_BITS));
    }
    for (let i = 1; i < arrBinChars.length; i++) {
        curPart = arrBinChars[i];
        let curZeroCount = 0;
        let j = 0;
        while (j < curPart.length && curPart[j] === "0") {
            curZeroCount++;
            j += 1;
        }
        if (curZeroCount < minZeroCount) minZeroCount = curZeroCount;
    }

    arrBinChars[0] = "";
    if (minZeroCount < ENCODING_BITS) {
        arrBinChars[0] = String.fromCharCode(
            CAESAR_ZERO_COUNT.charCodeAt(0) + minZeroCount
        );
        for (let i = 1; i < arrBinChars.length; i++) {
            arrBinChars[i] = arrBinChars[i].substring(minZeroCount);
            arrBinChars[i] = Scramble(arrBinChars[i]);
        }
    }

    result = arrBinChars.join("");
    return result;
}

function findUser(details, callback) {
    var username = details.username;
    db.connect().then(function (connection) {
        var query = `Select top 1 * from USERS where USER_LOGIN = '${username}'`;
        connection.request(query).then(function (user) {
            callback(user);
        }).catch(function (err) {
            callback(err)
        })
    })
}

function editUser(details, callback) {
    const {int_login_id, username, name = "", region_id = "", school_id = "", newPassword = "", email = ""} = details;
    const encoded_password = encode_to_bin(newPassword);
    db.connect().then(function (connection) {
        var query = `update USERS set 
            USER_LOGIN = '${username}'
            ${name && `, USER_FIRST_NAME = '${name}'`} 
            ${region_id && `, REGION_ID = '${region_id}'`} 
            ${school_id && `, SCHOOL_ID = '${school_id}'`} 
            ${encoded_password && `, USER_PASSWORD = '${encoded_password}'`} 
            ${email && `, USER_EMAIL = '${email}'`} 
            where USER_ID = ${int_login_id}`;
            console.log(details);
            console.log(query);
        connection.request(query).then(function () {
            callback();
        }).catch(function (err) {
            callback(err)
        })
    })
}

function updatePassword(details, callback) {
    const { username, password = "" } = details;
    const encoded_password = encode_to_bin(password);
    db.connect().then(function (connection) {
        var query = `update USERS set USER_PASSWORD = '${encoded_password}' 
                where USER_LOGIN = '${username}' and DATE_DELETED is null`;
            console.log(details);
            console.log(query);
        connection.request(query).then(function () {
            callback();
        }).catch(function (err) {
            callback(err)
        })
    })
}

function createUser(details, callback) {
    const {
        username,
        name = "",
        regionId = null,
        schoolId = null,
        password = "",
        email = "",
        roleId
    } = details;
    const encoded_password = encode_to_bin(password);
    const user_type = easyCoachRoles[roleId];
    const user_permissions = easyCoachPermissions[roleId];
    db.connect().then(function (connection) {
        var query = `insert into USERS 
            (USER_LOGIN, USER_FIRST_NAME, REGION_ID, SCHOOL_ID, USER_PASSWORD, USER_EMAIL, USER_TYPE, USER_PERMISSIONS, DATE_LAST_MODIFIED) 
            output inserted.USER_ID as 'user_id' 
            values ('${username}', '${name}', ${regionId}, ${schoolId}, '${encoded_password}', '${email}', '${user_type}', '${user_permissions}', '${formatDate(new Date())}')`;
            console.log(details);
            console.log(query);
        connection.request(query).then(function (res) {
            callback(res);
        }).catch(function (err) {
            callback(err)
        })
    }).catch(function (err) {
        callback(err)
    })
}

function createSchool(details, callback) {
    db.connect().then(function (connection) {
        var query = `insert into SCHOOLS 
            (SYMBOl, SCHOOL_NAME, CITY_ID, ADDRESS, MAIL_ADDRESS, MAIL_CITY_ID, ZIP_CODE, EMAIL, PHONE, FAX, MANAGER_NAME, MANAGER_CELL_PHONE, 
                FROM_GRADE, TO_GRADE, SUPERVISION_TYPE, SECTOR_TYPE, REGION_ID, CLUB_STATUS, DATE_LAST_MODIFIED) 
            output inserted.SCHOOL_ID as 'school_id' 
            values (@symbol, @schoolName, @cityId, @address, @mailAddress, @mailCityId, @zipCode, @email, @phoneNumber, @fax, @managerName, @managerPhone, 
                @fromGrade, @toGrade, @supervisionType, @sectorType, @regionId, @clubStatus, '${formatDate(new Date())}')`;
        const params = {
            symbol: details.symbol,
            schoolName: details.schoolName || "",
            cityId: details.cityId || null,
            address: details.address,
            mailAddress: details.mailAddress,
            zipCode: details.zipCode,
            email: details.email,
            phoneNumber: details.phoneNumber,
            fax: details.fax,
            managerName: details.managerName,
            managerPhone: details.managerPhone,
            supervisionType: details.supervisionType || 3,
            sectorType: details.sectorType || null,
            clubStatus: details.clubStatus || 1,
            mailCityId: details.mailCityId || null,
            regionId: details.regionId || null,
            fromGrade: details.fromGrade || null,
            toGrade: details.toGrade || null,
        };
        console.log(details);
        console.log(query);
        console.log(params);
        connection.request(query, params).then(function (res) {
            if (res[0]?.school_id) {
                getOrCreateSchoolRegistration({
                    school: res[0]?.school_id,
                    season: details.season || Season.current(),
                    schoolName: details.schoolName || "",
                })
            }
            callback(res);
        }).catch(function (err) {
            callback(err)
        })
    }).catch(function (err) {
        callback(err)
    })
}

function findSchool(details, callback) {
    var symbol = details.symbol;
    db.connect().then(function (connection) {
        var query = `Select top 1 * from SCHOOLS where SYMBOL = '${symbol}' AND DATE_DELETED is null`;
        connection.request(query).then(function (school) {
            callback(school);
        }).catch(function (err) {
            callback(err)
        })
    })
}

function editSchool(details, callback) {
    const { intSchoolId, schoolName = "", address = "", mailAddress = "", email = "",
        zipCode = "", phoneNumber = "", fax = "", managerName = "", managerPhone = "", 
        regionId = null, cityId = null, mailCityId = null, 
        fromGrade = null, toGrade = null } = details;
    db.connect().then(function (connection) {
        var query = `update SCHOOLS set 
            DATE_LAST_MODIFIED = '${formatDate(new Date())}' 
            ${schoolName && `, SCHOOL_NAME = '${schoolName}'`} 
            ${address && `, ADDRESS = '${address}'`} 
            ${mailAddress && `, MAIL_ADDRESS = '${mailAddress}'`} 
            ${email && `, EMAIL = '${email}'`} 
            ${zipCode && `, ZIP_CODE = '${zipCode}'`} 
            ${phoneNumber && `, PHONE = '${phoneNumber}'`} 
            ${fax && `, FAX = '${fax}'`} 
            ${managerName && `, MANAGER_NAME = '${managerName}'`} 
            ${managerPhone && `, MANAGER_CELL_PHONE = '${managerPhone}'`} 
            ${regionId && `, REGION_ID = '${regionId}'`} 
            ${cityId && `, CITY_ID = '${cityId}'`} 
            ${mailCityId && `, MAIL_CITY_ID = '${mailCityId}'`} 
            ${fromGrade && `, FROM_GRADE = '${fromGrade}'`} 
            ${toGrade && `, TO_GRADE = '${toGrade}'`} 
            where SCHOOL_ID = ${intSchoolId}`;
            console.log(details);
            console.log(query);
        connection.request(query).then(function () {
            callback();
        }).catch(function (err) {
            callback(err)
        })
    })
}

function getOrCreateSchoolRegistration(details, callback) {
    db.connect().then(function (connection) {
        var query = "select count(*) as \"Count\" " +
            "from SchoolRegistrations " +
            "where School = @school and Season = @season and Club = 1";
        const params = {
            school: details.school,
            season: details.season || Season.current(),
        }
        connection.request(query, params).then(function (res) {
            if (res[0].Count == 0) {
                var createQuery = `insert into SchoolRegistrations 
                    (School, Season, Name, Type, Club) 
                    values (@school, @season, @schoolName, '2', '1')`;
                const createParams = {
                    school: details.school,
                    season: details.season || Season.current(),
                    schoolName: details.schoolName || "",
                };
                connection.request(createQuery, createParams);
                callback({status: "ok", message: "exists"});
            }
            callback({status: "ok", message: "created"});
        }).catch(function (err) {
            callback(err)
        })
    }).catch(function (err) {
        callback(err)
    })
}

function getTokens(user, callback) {
    var school = user.schoolID;
    if (school) {
        Season.current(user, function(currentSeason) {
            db.connect().then(function (connection) {
                var qs = 'Select Token, Identifier, Email ' +
                    'From TokenLogins ' +
                    'Where dbo.ExtractBetweenDelimeters(Identifier, \'-\', \'-\')=@school ' +
                    '   And dbo.ExtractBetweenDelimeters(Identifier, \'\', \'-\')=@season';
                    //'   And Expiration>GetDate()';
                var queryParams = {
                    school: school,
                    season: currentSeason
                };
                connection.request(qs, queryParams).then(function (records) {
                    var tokens = [];
                    for (var i = 0; i < records.length; i++) {
                        var record = records[i];
                        tokens.push({
                            type: record['Identifier'].split('-')[0],
                            token: record['Token']
                        });
                    }
                    callback(null, tokens);
                }, function(err) {
                    callback(err);
                });
            }, function(err) {
                callback(err);
            });
        });
    } else {
        callback(null, []);
    }
}

function getOrCreateTokens(user, callback) {
    var school = user.schoolID;
    var currentSeason = user.season;
    if (school) {
        db.connect().then(function (connection) {
            var qs = 'Select Token, Identifier, Email ' +
                'From TokenLogins ' +
                'Where dbo.ExtractBetweenDelimeters(Identifier, \'-\', \'-\')=@school ' +
                '   And dbo.ExtractBetweenDelimeters(Identifier, \'\', \'-\')=@season';
                //'   And Expiration>GetDate()';
            var queryParams = {
                school: school,
                season: currentSeason
            };
            connection.request(qs, queryParams).then(function (records) {
                var tokens = [];
                if (records.length > 0) {
                    for (var i = 0; i < records.length; i++) {
                        var record = records[i];
                        tokens.push({
                            type: record['Identifier'].split('-')[0],
                            token: record['Token']
                        });
                    }
                    callback(null, tokens);
                } else {
                    var users = user.users.length > 0 ? user.users : [];
                    var query = "insert into TokenLogins(Token, Code, Identifier, Email, Expiration, UserDetails, Status) values ";
                    for (var i = 0; i < users.length; i++) {
                        var newToken = generateToken();
                        var el = users[i];
                        query += `('${newToken}', 
                        '${el.phone}', 
                        '${el.type == 1 ? "principal" : "representative"}-${school}-${currentSeason}', 
                        '${el.email}', 
                        '2035-06-30 01:00:00.000', 
                        '${JSON.stringify({
                            displayName: "Name",
                            schoolID: school,
                            regionID: el.region,
                            defaultRoute: el.type == 1 ? "principal-approval/teams" : "representative-approval/teams",
                            roles: el.type == 1 ? ["principal-approval"] : ["representative-approval"]
                        })}', 
                        0)`;
                        if (i == users.length - 1) {
                            query += ";";
                        } else {
                            query += ", "
                        }
                    }
                    console.log("================ GET OR CREATE TOKENS QUERY ================");
                    console.log(query);

                    if (users.length > 0) {
                        connection.request(query).then(function () {
                            var qs = 'Select Token, Identifier, Email ' +
                                'From TokenLogins ' +
                                'Where dbo.ExtractBetweenDelimeters(Identifier, \'-\', \'-\')=@school ' +
                                '   And dbo.ExtractBetweenDelimeters(Identifier, \'\', \'-\')=@season';
                                //'   And Expiration>GetDate()';
                            var queryParams = {
                                school: school,
                                season: currentSeason
                            };
                            return connection.request(qs, queryParams);
                        }).then(function (newTokens) {
                            for (var i = 0; i < newTokens.length; i++) {
                                var record = newTokens[i];
                                tokens.push({
                                    type: record['Identifier'].split('-')[0],
                                    token: record['Token']
                                });
                            }
                            callback(null, tokens);
                        })
                    } else {
                        callback(null, []);
                    }
                }
            }, function(err) {
                callback(err);
            });
        }, function(err) {
            callback(err);
        });
    } else {
        callback(null, []);
    }
}

function updateTokens(user, callback) {
    const school = user.schoolID;
    const currentSeason = user.season;

    if (school) {
        db.connect().then(function (connection) {
            var qs = 'Select Token, Identifier, Email ' +
                'From TokenLogins ' +
                'Where dbo.ExtractBetweenDelimeters(Identifier, \'-\', \'-\')=@school ' +
                '   And dbo.ExtractBetweenDelimeters(Identifier, \'\', \'-\')=@season';
                //'   And Expiration>GetDate()';
            var queryParams = {
                school: school,
                season: currentSeason
            };
            connection.request(qs, queryParams).then(function (records) {
                var tokens = [];
                const users = user.users.length > 0 ? user.users : [];
                const queryPromises = [];
                var query = "";

                if (records.length === 1) {
                    for (var i = 0; i < users.length; i++) {
                        const el = users[i];
                        if (el.type == 1) {
                            query = `update TokenLogins set Code = '${el.phone}' where Identifier = 'principal-${school}-${currentSeason}'; `;
                        } else {
                            let newToken = generateToken();
                            query = `insert into TokenLogins (Token, Code, Identifier, Email, Expiration, UserDetails, Status) 
                            values ('${newToken}', 
                                '${el.phone}', 
                                'representative-${school}-${currentSeason}', 
                                '${el.email}', 
                                '2035-06-30 01:00:00.000', 
                                '${JSON.stringify({
                                    displayName: "Name",
                                    schoolID: school,
                                    regionID: el.region,
                                    defaultRoute: "representative-approval/teams",
                                    roles: ["representative-approval"]
                                })}', 
                                0); `;
                        }
        
                        if (query) {
                            queryPromises.push(connection.request(query));
                        }
                    }
                } else if (records.length === 2) {
                    for (var i = 0; i < users.length; i++) {
                        const el = users[i];
                        if (el.type == 1) {
                            query = `update TokenLogins set Code = '${el.phone}' where Identifier = 'principal-${school}-${currentSeason}';`;
                        } else {
                            query = `update TokenLogins set Code = '${el.phone}' where Identifier = 'representative-${school}-${currentSeason}';`;
                        }
        
                        if (query) {
                            queryPromises.push(connection.request(query));
                        }
                    }
                } else {
                    query = "insert into TokenLogins(Token, Code, Identifier, Email, Expiration, UserDetails, Status) values ";
                    for (var i = 0; i < users.length; i++) {
                        let newToken = generateToken();
                        var el = users[i];
                        query += `('${newToken}', 
                        '${el.phone}', 
                        '${el.type == 1 ? "principal" : "representative"}-${school}-${currentSeason}', 
                        '${el.email}', 
                        '2035-06-30 01:00:00.000', 
                        '${JSON.stringify({
                            displayName: "Name",
                            schoolID: school,
                            regionID: el.region,
                            defaultRoute: el.type == 1 ? "principal-approval/teams" : "representative-approval/teams",
                            roles: el.type == 1 ? ["principal-approval"] : ["representative-approval"]
                        })}', 
                        0)`;
                        if (i == users.length - 1) {
                            query += ";";
                        } else {
                            query += ", "
                        }

                    }

                    if (query) {
                        queryPromises.push(connection.request(query));
                    }
                }

                if (users.length > 0) {
                    // Wait for all queries to finish
                    Promise.all(queryPromises)
                        .then(() => {
                                var qs = 'Select Token, Identifier, Email ' +
                                    'From TokenLogins ' +
                                    'Where dbo.ExtractBetweenDelimeters(Identifier, \'-\', \'-\')=@school ' +
                                    '   And dbo.ExtractBetweenDelimeters(Identifier, \'\', \'-\')=@season';
                                    //'   And Expiration>GetDate()';
                                var queryParams = {
                                    school: school,
                                    season: currentSeason
                                };
                                return connection.request(qs, queryParams);
                        })
                        .then(function (newTokens) {
                            for (var i = 0; i < newTokens.length; i++) {
                                var record = newTokens[i];
                                tokens.push({
                                    type: record['Identifier'].split('-')[0],
                                    token: record['Token']
                                });
                            }
                            callback(null, tokens);
                        })
                        .catch(err => {
                            console.error('Query error:', err);
                            callback(err);
                        });
                } else {
                    callback(null, []);
                }
            })
        }).catch(err => {
            console.error('Database connection error:', err);
            callback(err);
        });
    } else {
        callback(null, []);
    }
}

function generateToken() {
    return Math.floor(Math.random() * 1000000000000000).toString(36) +
        Math.floor(Math.random() * 1000000000000000).toString(36) +
        Math.floor(Math.random() * 1000000000000000).toString(36);
}

function generateLogin(code, identifier, email, details, callback) {
    var now = new Date();
    var currentYear = now.getFullYear();
    var endOfSeasonThisYear = new Date(currentYear, 5, 30); //June 30th
    var endOfSeasonNextYear = new Date(currentYear + 1, 5, 30); //June 30th
    var expiration = endOfSeasonThisYear > now ? endOfSeasonThisYear : endOfSeasonNextYear;
    var result = {
        code: code,
        identifier: identifier,
        email: email,
        expiration: expiration,
        userDetails: JSON.stringify(details)
    };

    db.connect()
        .then(
            function (connection) {
                connection.request(
                    "select Token as \"Token\" " +
                    "from TokenLogins " +
                    "where Identifier = @identifier",
                    {identifier: identifier})
                    .then(function (records) {
                        if (records.length > 0) {
                            var record = records[0];
                            result.token = records[0].Token;
                            return connection.request(
                                "update TokenLogins " +
                                "set Code = @code, " +
                                "  Email = @email, " +
                                "  Expiration = @expiration, " +
                                "  UserDetails = @userDetails, " +
                                "  Status = 0 " +
                                "where Token = @token",
                                result);
                        } else {
                            result.token = generateToken();
                            return connection.request(
                                "insert into TokenLogins(Token, Code, Identifier, Email, Expiration, UserDetails, Status) " +
                                "values(@token, @code, @identifier, @email, @expiration, @userDetails, 0)",
                                result);
                        }
                    })
                    .then(
                        function () {
                            connection.complete();
                            callback(null, result);
                        },
                        function (err) {
                            connection.complete();
                            callback(err);
                        });

            },
            function (err) {
                callback(err);
            }
        );
}

function updateUserRegion(user, callback) {
    if (user.schoolID == null && user.role !== 1) {
        callback(null, user);
        return;
    }
    db.connect()
        .then(
            function (connection) {
                var request;
                if (user.role === 1) {
                    request = connection.request(
                        "select REGION_ID as \"Region\" " +
                        "from USERS " +
                        "where USER_ID = @user",
                        {user: user.id});
                }
                else {
                    request = connection.request(
                        "select REGION_ID as \"Region\" " +
                        "from SCHOOLS " +
                        "where SCHOOL_ID = @school",
                        {school: user.schoolID});
                }
                request
                    .then(
                        function (records) {
                            connection.complete();

                            if (records.length > 0) {
                                var record = records[0];
                                user.regionID = record.Region;
                            }

                            callback(null, user);
                        },
                        function (err) {
                            connection.complete();
                            callback(err);
                        });
            },
            function (err) {
                callback(err);
            }
        );
}

module.exports = {
    validate: function (username, password, callback) {
        sportsman.UserLogin(username, password).then(function(sportsmanUserDetails) {
            callback(null, true);
        }, function(err) {
            callback(null, false);
        });
    },
    findUser: findUser,
    editUser: editUser,
    updatePassword: updatePassword,
    createUser: createUser,
    findSchool: findSchool,
    editSchool: editSchool,
    createSchool: createSchool,
    generateLogin: generateLogin,
    getTokens: getTokens,
    getOrCreateTokens: getOrCreateTokens,
    updateTokens: updateTokens,
    login: function (params, callback) {
        function GetUserData(username, password, userid) {
            return new Promise(function (fulfil, reject) {
                sportsman.UserLogin(username, password, userid).then(function(sportsmanUserDetails) {
                    var caption = (typeof userid !== 'undefined' && userid != null) ? 'ADMIN OVERRIDE ' + userid : username;
                    logger.log('verbose', 'Got valid sportsman login for ' + caption);
                    // console.log(sportsmanUserDetails);
                    var role = 2;
                    if (sportsmanUserDetails.Admin)
                        role = 1;
                    else if (sportsmanUserDetails.Type === 4)
                        role = 4;
                    fulfil({
                        Id: sportsmanUserDetails.Id,
                        Seq: sportsmanUserDetails.Id + settings.Sportsman.UserOffset,
                        Name: sportsmanUserDetails.Name,
                        Role: role,
                        Type: sportsmanUserDetails.Type,
                        School: sportsmanUserDetails.School,
                        RegionId: sportsmanUserDetails.RegionId,
                        RegionName: sportsmanUserDetails.RegionName,
                        CityId: sportsmanUserDetails.CityId,
                        CityName: sportsmanUserDetails.CityName,
                        CoordinatedRegion: sportsmanUserDetails.CoordinatedRegion,
                        Login: sportsmanUserDetails.UserLogin
                    });
                }, function(err) {
                    reject(err);
                });
            });
        }

        if (params.username != null || params.userid != null) {
            GetUserData(params.username, params.password, params.userid).then(function (data) {
                if (data == null || data.Seq == null || data.Seq <= 0) {
                    callback({status: 401, message: "שם משמתמש או סיסמה שגויים"});
                } else {
                    if (params.username == null) {
                        params.username = data.Login;
                    }
                    var schoolSymbol = data.School ? data.School.Symbol : null;
                    var schoolID = data.School ? data.School.Id : null;
                    var coordinatedRegionId = data.CoordinatedRegion ? data.CoordinatedRegion.Id : null;
                    var coordinatedRegionName = data.CoordinatedRegion ? data.CoordinatedRegion.Name : null;
                    //logger.log('verbose', 'Got valid sportsman login for ' + username);
                    Season.current({id: data.Id, username: params.username}, function(currentSeason) {
                        var user = {
                            id: data.Id,
                            seq: data.Seq,
                            username: params.username,
                            displayName: data.Name,
                            role: data.Role,
                            schoolSymbol: schoolSymbol,
                            schoolID: schoolID,
                            regionID: data.RegionId,
                            regionName: data.RegionName,
                            cityID: data.CityId,
                            cityName: data.CityName,
                            year: data.Year,
                            coordinatedRegionID: coordinatedRegionId,
                            coordinatedRegionName: coordinatedRegionName,
                            season: currentSeason,
                            activeSeason: Season.active()
                        };
                        console.log(user);
                        if (data.Role === 1) {
                            user.defaultRoute = 'manage/dashboard';
                            user.roles = ['admin'];
                        }
                        else if (data.Type == 3) {
                            user.defaultRoute = 'supervisor/club-teams-approval';
                            user.roles = ['supervisor'];
                        }
                        else if (data.Type == 4) {
                            user.defaultRoute = 'finance/accounts';
                            user.roles = ['finance'];
                        }
                        else if (data.Type == 5) {
                            user.defaultRoute = 'registration/select';
                            user.roles = ['city'];
                        }
                        else if (data.Type == 6) {
                            user.defaultRoute = 'project-supervisor/project-teams-approval';
                            user.roles = ['sport-admin'];
                        }
                        else if (user.schoolID) {
                            user.defaultRoute = 'registration/select';
                            user.roles = ['school'];
                        } else {
                            console.log(user);
                            callback({status: 401, message: "סוג משתמש לא מזוהה"});
                            return;
                        }
                        updateUserRegion(user, function (err, user) {
                            if (err) {
                                logger.error(err);
                                callback({status: 401, message: "שם משמתמש או סיסמה שגויים"});
                            } else {
                                callback(null, user);
                            }
                        });
                    });
                }
            }, function (err) {
                logger.error(err);
                callback({status: 401, message: "שם משמתמש או סיסמה שגויים"});
            });
        }
        else if (params.token) {
            db.connect()
                .then(
                    function (connection) {
                        connection.request(
                            "select Code as \"Code\", Expiration as \"Expiration\", UserDetails as \"UserDetails\" " +
                            "from TokenLogins " +
                            "where Token = @token",
                            params)
                            .then(
                                function (records) {
                                    connection.complete();
                                    if (records.length > 0) {
                                        var record = records[0];
                                        //(record.Expiration == null || record.Expiration > new Date()) &&
                                        if (record.Code.trim() === params.code.trim()) {
                                            callback(null, JSON.parse(record.UserDetails));
                                            return;
                                        }
                                    }

                                    callback({status: 401, message: "קוד התחברות שגוי"});
                                },
                                function (err) {
                                    connection.complete();
                                    logger.error(err);
                                    callback({status: 500, message: "שגיאה בנסיון התחברות"});
                                }
                            )
                    },
                    function (err) {
                        logger.error(err);
                        callback({status: 500, message: "שגיאה בנסיון התחברות"});
                    });
        }
    }
};