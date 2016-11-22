var App;
(function (App) {
    var Random = (function () {
        function Random() {
        }
        Random.generate = function () {
            return Math.random().toFixed(2);
        };
        Random.getRandomColor = function () {
            var alphabet = '0123456789ABCDEF';
            var color = '#';
            for (var i = 0; i < 6; i++) {
                color += alphabet[Math.floor(Math.random() * 16)];
            }
            return color;
        };
        return Random;
    }());
    App.Random = Random;
    var Constants = (function () {
        function Constants() {
        }
        Constants.ROWS = 10;
        Constants.COLS = 5;
        Constants.SCALE = 2;
        Constants.CHART_OPTIONS = {
            scales: {
                xAxes: [{
                        display: true
                    }],
                yAxes: [{
                        display: true,
                        scaleLabel: {
                            show: true,
                            labelString: 'Value'
                        },
                        ticks: {
                            suggestedMin: 0,
                            suggestedMax: 1
                        }
                    }]
            }
        };
        return Constants;
    }());
    App.Constants = Constants;
    var Main = (function () {
        function Main(table) {
            this.table = table;
            this.dataFromTable = [];
            this.labelNames = ['Защищенность',
                'Интенсивность отражения угрозы',
                'Интенсивность контроля',
                'Интенсивность воздействия',
                'Интенсивность отказов'];
            //целевая функция
            this.ema = new EMA({ period: App.Constants.SCALE, values: [] });
            this.targetFunc = 1;
            // Вероятность отражения угрозы
            this.pOt = 0.8;
            this.initTable(App.Constants.ROWS);
            this.fillTableWithData();
            this.render();
        }
        Main.prototype.newData = function () {
            $("table tbody").empty();
            this.initTable(App.Constants.ROWS);
            this.fillTableWithData();
        };
        /**
         * Защищенность
         * @param {Number} i_ot интенсивность отражения угрозы
         * @param {Number} i_c интенсивность контроля
         * @param {Number} i_v интенсивность воздействия угрозы
         * @return {Number} target value
         */
        Main.prototype.calculateTargetValue = function (i_ot, i_c, i_v) {
            var local_ot = 1 / i_ot;
            var local_c = 1 / i_c;
            var local_v = i_v * (1 - this.pOt);
            var local_n = 1 / local_v;
            var result = local_v / (local_n + local_ot + local_c);
            return result.toFixed(2);
        };
        Main.prototype.getLCL = function (k, rowNumber) {
            return this.targetFunc - App.Constants.SCALE * this.getSigma(k, rowNumber) * this.getLCLsqrt(k);
        };
        Main.prototype.getSigma = function (k, rowNumber) {
            var xSum = 0, xCur = this.dataFromTable[rowNumber][k], n = this.dataFromTable[rowNumber].length;
            for (var i = 0; i < n; i++) {
                var elem = this.dataFromTable[rowNumber][i];
                xSum += Math.pow(elem - xCur, 2);
            }
            return Math.sqrt(xSum / n);
        };
        Main.prototype.getLCLsqrt = function (k) {
            var lambda = 0.2, part1 = lambda / (2 - lambda), part2 = 1 - Math.pow((1 - lambda), (2 * k + 1));
            return Math.sqrt(part1 * part2);
        };
        Main.prototype.initTable = function (rowCount) {
            var rows = [], colsNum = this.table.find('td').length, row, el;
            for (var i = 0; i < rowCount; i++) {
                row = [];
                for (var j = 0; j < colsNum; j++) {
                    if (j === 0) {
                        el = i + 1;
                    }
                    else {
                        el = '<input type="text" class="cell form-control"/>';
                    }
                    row.push('<td>' + el + '</td>');
                }
                rows.push('<tr>' + row + '</tr>');
            }
            this.table.find("tbody").append(rows);
        };
        Main.prototype.fillTableWithData = function () {
            var cells = $('.cell');
            for (var i = 0; i < App.Constants.ROWS; i++) {
                var index = i * App.Constants.COLS;
                for (var j = 1; j <= 4; j++) {
                    cells.eq(index + j).val(App.Random.generate());
                }
                var value = this.calculateTargetValue(cells.eq(index + 1).val(), cells.eq(index + 2).val(), cells.eq(index + 3).val());
                cells.eq(index).val(value);
            }
        };
        Main.prototype.recalculateUiData = function () {
            var cells = $('.cell');
            for (var i = 0; i < App.Constants.ROWS; i++) {
                var index = i * App.Constants.COLS;
                cells.eq(index).val(this.calculateTargetValue(cells.eq(index + 1).val(), cells.eq(index + 2).val(), cells.eq(index + 3).val()));
            }
        };
        Main.prototype.retrieveDataFromTable = function () {
            var rows = this.table.find('tr');
            this.dataFromTable = [];
            for (var i = 0; i < App.Constants.COLS; i++) {
                this.dataFromTable.push([]);
            }
            var self = this;
            //skip first row
            for (var i = 1; i < rows.length; i++) {
                rows.eq(i).children('td').map(function (j) {
                    if (j === 0) {
                        return;
                    }
                    var val = $(this).find('input').val();
                    if (val) {
                        return self.dataFromTable[j - 1].push(parseFloat(val));
                    }
                }).get();
            }
        };
        Main.prototype.render = function () {
            var _this = this;
            var dataset, labelsX = [];
            // обновляем целевую функцию
            this.targetFunc = $('.targetFunc').val() || this.targetFunc;
            this.recalculateUiData();
            this.retrieveDataFromTable();
            for (var i = 1; i <= App.Constants.ROWS; i++) {
                labelsX.push(i);
            }
            dataset = this.dataFromTable.map(function (line, i) {
                return {
                    label: _this.labelNames[i],
                    fill: false,
                    borderColor: App.Random.getRandomColor(),
                    borderWidth: 2,
                    data: line.map(function (elem, num) {
                        return {
                            x: num,
                            y: elem
                        };
                    })
                };
            });
            this.render_fillDatasetWithLcl(dataset);
            this.render_fillDatasetWithEwma(dataset);
            this.render_updateChart(dataset, labelsX);
        };
        Main.prototype.render_fillDatasetWithLcl = function (dataset) {
            var _this = this;
            this.dataFromTable.map(function (line, i) {
                dataset.push({
                    label: 'LCL: ' + _this.labelNames[i],
                    fill: false,
                    borderColor: App.Random.getRandomColor(),
                    borderWidth: 2,
                    borderDash: [5, 15],
                    data: line.map(function (elem, num) {
                        var lcl = _this.getLCL(num, i);
                        return {
                            x: num,
                            y: lcl
                        };
                    })
                });
            });
        };
        Main.prototype.render_fillDatasetWithEwma = function (dataset) {
            var _this = this;
            this.dataFromTable.map(function (line, i) {
                dataset.push({
                    label: 'EWMA:' + _this.labelNames[i],
                    fill: false,
                    borderColor: App.Random.getRandomColor(),
                    borderWidth: 1,
                    borderDash: [15, 25],
                    data: line.map(function (elem, num) {
                        return {
                            x: num,
                            y: _this.ema.nextValue(elem) || elem
                        };
                    })
                });
            });
        };
        Main.prototype.render_updateChart = function (dataset, labelsX) {
            if (this.chart) {
                this.chart.destroy();
                this.chart.clear();
                delete this.chart;
            }
            this.chart = new Chart($('#chart').eq(0), {
                type: 'line',
                data: {
                    labels: labelsX,
                    datasets: dataset
                },
                options: App.Constants.CHART_OPTIONS
            });
        };
        return Main;
    }());
    App.Main = Main;
})(App || (App = {}));
var main;
$(document).ready(function () {
    main = new App.Main($('.table'));
    $('.render').off("click").on("click", function () { return main.render(); });
    $('.newData').off('click').on('click', function () { return main.newData(); });
});
//# sourceMappingURL=main.js.map