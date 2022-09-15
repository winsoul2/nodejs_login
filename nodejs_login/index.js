const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');
const dbConnection = require('./database');
const { body, validationResult } = require('express-validator');
const multer = require('multer');

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '.jpg') //Appending .jpg
    }
})

var upload = multer({ storage: storage });

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")))

// SET OUR VIEWS AND VIEW ENGINE
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// APPLY COOKIE SESSION MIDDLEWARE
app.use(cookieSession({
    name: 'session',
    keys: ['key1', 'key2'],
    maxAge: 3600 * 1000 // 1hr
}));

// DECLARING CUSTOM MIDDLEWARE
const ifNotLoggedin = (req, res, next) => {
    if (!req.session.isLoggedIn) {
        return res.render('login-register');
    }
    next();
}
const ifLoggedin = (req, res, next) => {
    if (req.session.isLoggedIn) {
        return res.redirect('/home');
    }
    next();
}
app.get('/graph',(req, res, next) => {
    return res.render('graph')
} )

// END OF CUSTOM MIDDLEWARE
// ROOT PAGE
app.get('/', ifNotLoggedin, (req, res, next) => {
    // if(type == "desc"){
    //     my = asc
    // }else{
    //     my = desc
    // }
    dbConnection.execute("SELECT * FROM `users` JOIN `atk` ON users.email=atk.email WHERE users.email=? ORDER BY `dateup` asc ;", [req.session.userEmail])
        .then(([rows]) => {
            dbConnection.execute("SELECT * FROM `users` WHERE users.email=?", [req.session.userEmail])
                .then(([rows2]) => {
                    res.render('home', {
                        name: rows2[0],
                        rows: rows
                    });
                })
        });


});// END OF ROOT PAGE



//img
app.post('/img', upload.single("file"), (req, res) => {

    let { email, birthday, birthday1, info, check , info2} = req.body
    if (birthday1 == "0001-01-01") {
        birthday1 = "2010-01-01";
    }
    if (check === undefined) {
        check = 'off'
    }

    dbConnection.execute("INSERT INTO `atk`(`email`, `filename`, `dateup`, `dateinf`, `note`, `infect`, `atk`)  VALUE (?,?,?,?,?,?,?)",
        [email, req.file.filename, `${birthday} 23:03:28`, `${birthday1} 23:03:28`, info, check, info2])
        .then(() => {
            res.redirect("/")
        })
});




//remove
app.get("/remove/:id", upload.fields([]), (req, res) => {

    dbConnection.execute("DELETE FROM `atk` WHERE `id`=?", [req.params.id])
        .then(() => {
            res.redirect("/")
        })
})

// app.post('/sort', (req, res) => {
//     dbConnection.execute("SELECT * FROM `users2` ORDER BY `id` asc", [req.params])
// })




// REGISTER PAGE
app.post('/register', ifLoggedin,
    // post data validation(using express-validator)
    [
        body('user_email', 'Invalid email address!').isEmail().custom((value) => {
            return dbConnection.execute('SELECT `email` FROM `users` WHERE `email`=?', [value])
                .then(([rows]) => {
                    if (rows.length > 0) {
                        return Promise.reject('This E-mail already in use!');
                    }
                    return true;
                });
        }),
        body('user_name', 'Username is Empty!').trim().not().isEmpty(), //ถ้าไม่ได้พิมพ์ username จะขึ้นข้อความ Username is Empty!
        body('user_pass', 'The password must be of minimum length 6 characters').trim().isLength({ min: 6 }),
    ],// end of post data validation จบตรวจสอบข้อมูล
    (req, res, next) => {

        const validation_result = validationResult(req);
        const { user_name, user_pass, user_email } = req.body;
        // IF validation_result HAS NO ERROR
        if (validation_result.isEmpty()) { //เช็ดผลลัพธ์ไม่มี Error ก็จะไปต่อดึง bcypetมาเข้ารหัส
            // password encryption (using bcryptjs)
            bcrypt.hash(user_pass, 12).then((hash_pass) => { 
                // INSERTING USER INTO DATABASE
                dbConnection.execute("INSERT INTO `users`(`name`,`email`,`password`) VALUES(?,?,?)", [user_name, user_email, hash_pass])
                    .then(result => {
                        res.send(`your account has been created successfully, Now you can <a href="/">Login</a>`);
                    }).catch(err => {
                        // THROW INSERTING USER ERROR'S
                        if (err) throw err;
                    });
            })
                .catch(err => {
                    // THROW HASING ERROR'S
                    if (err) throw err;
                })
        }
        else {
            // COLLECT ALL THE VALIDATION ERRORS
            let allErrors = validation_result.errors.map((error) => {
                return error.msg;
            });
            // REDERING login-register PAGE WITH VALIDATION ERRORS
            res.render('login-register', {
                register_error: allErrors,
                old_data: req.body
            });
        }
    });// END OF REGISTER PAGE


// LOGIN PAGE
app.post('/', ifLoggedin, [
    body('user_email').custom((value) => {
        return dbConnection.execute('SELECT email FROM users WHERE email=?', [value])
            .then(([rows]) => {
                if (rows.length == 1) {
                    return true;
                }
                return Promise.reject('Invalid Email Address!');

            });
    }),
    body('user_pass', 'Password is empty!').trim().not().isEmpty(),
], (req, res) => {
    const validation_result = validationResult(req);
    const { user_pass, user_email } = req.body;
    // console.log(user_pass, user_email)
    if (validation_result.isEmpty()) { //เช็ดข้อมูลไม่มีerrorอะไร
        
        dbConnection.execute("SELECT * FROM `users` WHERE `email`=?", [user_email])
            .then(([rows]) => {
            
                bcrypt.compare(user_pass, rows[0].password).then(compare_result => {
                    if (compare_result === true) {
                        req.session.isLoggedIn = true;
                        req.session.userEmail = rows[0].email;

                        res.redirect('/');
                    }
                    else {
                        res.render('login-register', {
                            login_errors: ['Invalid Password!']
                        });
                    }
                })
                    .catch(err => {
                        if (err) throw err;
                    });


            }).catch(err => {
                if (err) throw err;
            });
    }
    else {
        let allErrors = validation_result.errors.map((error) => {
            return error.msg;
        });
        // REDERING login-register PAGE WITH LOGIN VALIDATION ERRORS
        res.render('login-register', {
            login_errors: allErrors
        });
    }
});

// END OF LOGIN PAGE

// LOGOUT
app.get('/logout', (req, res) => {
    //session destroy
    req.session = null;
    res.redirect('/');
});

// END OF LOGOUT
app.use('/', (req, res) => {
    res.status(404).send('<h1>404 Page Not Found!</h1>');
});

app.use('/add', (req, res, next) => {
    res.render('views/add', {

    })
})


app.listen(3000, () => console.log("Server is Running..."));




//-------------------------------------------

