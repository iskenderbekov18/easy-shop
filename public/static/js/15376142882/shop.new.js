function redirect(link, noref) {

    var deviceAgent = navigator.userAgent;
    var ios = deviceAgent.toLowerCase().match(/(iphone|ipod|ipad)/);
    if (noref) {
        var meta = document.createElement('meta');
        meta.name = "referrer";
        meta.content = "no-referrer";
        document.getElementsByTagName('head')[0].appendChild(meta);
        meta.remove();
    }
    if(!noref){
        var meta = document.createElement('meta');
        meta.name = "referrer";
        meta.content = "no-referrer-when-downgrade";
        document.getElementsByTagName('head')[0].appendChild(meta);
        meta.remove();
    }
    if (ios) {
        window.location.href = link;
    } else {
        var a = document.createElement("a");
        a.href = link;
        a.target = "_blank";
        if (noref) {
            a.rel = "noreferrer noopener";
        }else{
            a.rel = "no-referrer-when-downgrade";
        }
        a.click();
        a.remove();
    }
}


$(function () {

    var isiShop = {
        variables: {
            shop_currency: shop_currency,
            currency: 'wmr',
            currency_str: 'руб.',
            discountPercent: 0,
            createPayment: false,
            storage: localStorage
        },
        generateSum: function (count) {
            if (count > this.variables.good_count) {
                $('.choose_popup #currency').hide();
                return shopMessages[0];
            } else {
                var sum;
                sum = count * this.getCurrency();
                sum = this.generateSumDiscount(sum);

                if (this.variables.currency == 'qiwi')
                    return sum.toFixed(2);
                else if (this.variables.currency == 'btc')
                    return sum.toFixed(8);
                else
                    return Math.ceil(sum * 100) / 100; // 1.001 -> 1.01
                //return parseFloat(sum.toFixed(3)); // 1.1, but 1.001
            }
        },
        getCurrency: function () {
            var price;
            if (this.variables.currency == 'wmz') {
                price = this.variables.good_priceusd;
                this.variables.currency_str = '$';
            } else if (this.variables.currency == 'btc') {
                price = this.variables.good_pricebtc;
                this.variables.currency_str = 'BTC';
            } else {
                price = this.variables.good_pricerub;
                this.variables.currency_str = 'руб.';
            }

            $('.choose_popup #currency').show().text(this.variables.currency_str);

            return price;
        },
        generateSumDiscount: function (sum) {
            if (this.variables.discountPercent > 0) {
                sum = sum - (sum / 100 * this.variables.discountPercent);
            }

            return sum;
        },
        onWindowClose: function () {
            if (this.variables.createPayment === true) {
                return shopMessages[1];
            }
        },
        onPopupClose: function () {
            if (this.variables.createPayment === true) {
                return confirm(shopMessages[1]);
            } else {
                return true;
            }
        }
    };

    /**
     * ссылка для подтверждения email
     */
    var tmt = null;
    $('.check-email').on('input', 'input[name="email"]', function (e) {
        var email = $('input[name="email"]').val();
        var a = $('.confirm-email');
        a.attr('href', '/email/send/' + '?email=' + email);
        if (tmt !== null) {
            clearTimeout(tmt);
        }
        tmt = setTimeout(function () {
            $.post('/email/check', {'email': email}, function (data) {
                if (!data.error) {
                    $('.check-email .error-email').hide();
                    a.show();
                }
                if (data.result) {
                    $('.check-email .info-email').hide();
                    a.hide();
                } else {
                    $('.check-email .info-email').show();
                    a.show();
                }
                if (data.error) {
                    $('.check-email .error-email').text(data.error);
                    $('.check-email .error-email').show();
                    a.hide();
                }
            }, 'json');
        }, 1000);

    });

    /**
     * Оплата с помощью вебмани не прерывает процесс покупки
     */
    $(document).on('click', '#btnwmk', function () {
        isiShop.variables.createPayment = false;
    });

    window.onbeforeunload = function (e) {
        return isiShop.onWindowClose();
    };

    $(document).on('click', '.choose_popup .fa-times, .success_popup .fa-times', function (e) {
        if (isiShop.onPopupClose()) {
            $("#overlay, .choose_popup, .success_popup").fadeOut("slow");
            $('body').removeClass('popup-open');
            isiShop.variables.createPayment = false;
        }
    });

    $(document).keyup(function (e) {
        if (e.keyCode == 27 && isiShop.onPopupClose()) {
            $("#overlay, .choose_popup, .success_popup").fadeOut("slow");
            $('body').removeClass('popup-open');
            isiShop.variables.createPayment = false;
        }
    });

    /**
     * Открываем попап
     */
    $(document).on('click', 'a.buy, .good-container', function (e) {

        isiShop.variables.currency = $('select[name=paymethod]').val();

        var $popup = $('.choose_popup');

        var tr = $(this).parents('tr'),
            dData = $(this);

        if (tr.length > 0) {
            data = tr.data();
        } else {
            data = dData.data();
        }

        $('.order_popup').remove(); // if last form already exists
        $('#order').show();
        $('body').addClass('popup-open');

        $.each(data, function (i, elem) {
            isiShop.variables['good_' + i] = elem;
        });

        isiShop.variables.discountPercent = 0;

        $popup.find('#good_title').text(data.title);
        $popup.find('#good_count').val(data.mincount);
        $popup.find('#discount_code').val('');

        $('.choose_popup #sum').text(isiShop.generateSum(data.mincount)); // дефолтная сумма по мин кол-ву акков

        $("#overlay, .choose_popup").fadeIn("slow");

        if (isiShop.variables.storage.getItem('lastorder') != null) {
            $('#btn-window').show();
        }

        return false;
    });

    /**
     * Открываем попап с данными из "Закрыли окно?"
     */
    $("#btn-window").on('click', function (e) {
        isiShop.variables.createPayment = true;

        $('#order').hide();
        $('.choose_popup .popup-modal').append(isiShop.variables.storage.getItem('lastorder'));
        var payType = $('input[data-pay-type]');

        if (payType.attr('data-pay-type') == 'btc') {
            checkBTC($('input[name="order"]').val(), 0, 0, $('input[name="secret"]').val());
        }

        var csrfToken = $('#order input[name="csrf_token"]').val();
        $('.choose_popup .popup-modal input[name="csrf_token"]').val(csrfToken);
        $('#btn-window').hide();
    });

    /**
     * Кол-во товара может быть только целым числом
     * Расчитываем сумму заказа
     */
    $('#good_count, #discount, input[name="email"]').on('input, change', function (e) {

        var dataS = $(this).closest('form').serialize();
        if (typeof isiShop != 'undefined') {
            var goodid = isiShop.variables.good_id;

            dataS = dataS + '&good_id=' + goodid;
        }
        $.post('/calculate', dataS, function (data) {
            var count = this.value || 0;
            $('.choose_popup #sum').text(isiShop.generateSum(count));
            if (data) {
                $('.choose_popup #sum').text(data);

                if ($('input[name="paymethod"]').val() == 'btc') {
                    $('#currency').text('btc');
                } else {
                    $('#currency').text('руб.');
                }
            }
        }, 'json');

    });

    // /**
    //  * Получаем сумму скидки
    //  */
    // $('#discount_code').on('keydown keyup paste', function (e) {
    //     var dv = this.value,
    //         action = $(this).attr('data-action'),
    //         count = $("#good_count").val() || 0;
    //
    //     if (e.type == 'keyup') {
    //         if (dv.length == 11) {
    //             $.post(action, {
    //                 code: dv,
    //                 gid: isiShop.variables.good_id,
    //                 shop: isiShop.variables.good_shopid
    //             }, function (json) {
    //                 if (json.ok) {
    //                     isiShop.variables.discountPercent = parseInt(json.percent);
    //                     $('.choose_popup #sum').text(isiShop.generateSum(count))
    //                 } else {
    //                     isiShop.variables.discountPercent = 0;
    //                     $('.choose_popup #sum').text(isiShop.generateSum(count))
    //                 }
    //             }, 'json');
    //         } else {
    //             isiShop.variables.discountPercent = 0;
    //             $('.choose_popup #sum').text(isiShop.generateSum(count))
    //         }
    //     }
    // });

    /**
     * Выбираем метод оплаты
     */
    $(document).on('change', 'select[name=paymethod]', function () {
        isiShop.variables.currency = $(this).val();
        var count = $("#good_count").val() || 0;
        $('.choose_popup #sum').text(isiShop.generateSum(count));
    });

    $(document).on('click', 'input.clipboard', function () {
        this.select();
    });

    $(document).on('click', '.order_popup h4 .close', function () {
        $('.order_popup').remove();
        $('#buy-btn').attr('disabled', false);
    });

    function validateEmail(email) {
        var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
    }

    // Создание заказа
    $(document).on('submit', '#order', function (event) {
        var dataS = $(this).serialize();

        if (typeof isiShop != 'undefined') {
            var link = $(this).attr('action'),
                email = $('input[name=email]', this).val(),
                count = $('input[name=count]', this).val() || 0,
                goodid = isiShop.variables.good_id,
                min_count = isiShop.variables.good_mincount,
                paymethod = $('select[name=paymethod]', this).val(),
                count_accs = isiShop.variables.good_count;

            dataS = dataS + '&type=' + goodid;
        }

        if (!validateEmail(email)) {
            alert(shopMessages[2]);
            return false;
        }

        if (parseInt(count) < parseInt(min_count)) {
            alert(shopMessages[3] + ' ' + min_count);
            return false;
        }

        if (parseInt(count_accs) < parseInt(count)) {
            alert(shopMessages[4]);
            return false;
        }

        if (paymethod == 0) {
            alert(shopMessages[5]);
            return false;
        }

        $.ajax({
            type: "POST",
            url: link,
            data: dataS,
            dataType: "json",
            success: function (json) {
                if (json.order) {
                    $('#order').hide();
                    $('.order_popup').remove();
                    $('.choose_popup .popup-modal').append(json.order);

                    isiShop.variables.storage.setItem('lastorder', json.order);
                    isiShop.variables.createPayment = true;
                    $('#btn-window').hide();
                } else if (json.errors) {
                    if (json.errors.global)
                        alert(json.errors.global);
                    else if (json.errors.pay)
                        alert(json.errors.pay);
                }

                if (json.btc_address) {
                    checkBTC($(json.order).find('input[name="order"]').val(), 1, 0, $(json.order).find('input[name="secret"]').val());
                }

                if (json.fee) $('.order_fee span').text(json.fee);
            },
            error: function (data) {
                alert(shopMessages[6]);
            }
        });

        event.preventDefault();
    });

    var hasLink = '';
    // Проверка оплаты товара
    $(document).on('submit', '#pay', function (event) {
        var chk = $('.check_pay .check'),
            link = $(this).attr('action');

        chk.addClass('loading').html('');
        $('.check_pay input[type="submit"]').prop('disabled', true);

        var dataS = $(this).serialize();


        $.ajax({
            type: "POST",
            url: link,
            data: dataS,
            dataType: "json",
            success: function (json) {
                $('input[name="csrf_token"]').val(json.csrf);
                chk.removeClass('loading');
                $('.check_pay input[type="submit"]').prop('disabled', false);

                if (typeof json.redirect != 'undefined') {
                    isiShop.variables.createPayment = false;
                    isiShop.variables.storage.removeItem('lastorder');
                    if ($.inArray($('input[name="paymethod"]').val(), ['freekassa', 'unitpay', 'robokassa', 'enotio', 'qiwip2p', 'payeer']) >= 0 && !$('input[name="check"]').length) {
                        $('input[name="paymethod"]').append('<input name="check" value="true"/>');
                        $('input[type="submit"]').val('Проверить оплату').removeClass('btn-success').addClass('btn-primary');
                        if ($('input[name="paymethod"]').val() == 'qiwip2p') {
                            redirect(json.redirect, false);
                        } else {
                            redirect(json.redirect, true);
                        }
                    } else {
                        window.location.href = json.redirect;
                    }
                } else if (json.errors || (json.ok && json.link) || hasLink != '') {
                    if (!json.errors || json.errors.payed) {
                        isiShop.variables.createPayment = false;
                        isiShop.variables.storage.removeItem('lastorder');

                        hasLink = json.link || hasLink;

                        $('.check_pay .check').html(hasLink);
                    }

                    if (json.errors) {
                        if (json.errors.global) $('.check_pay .check').html(json.errors.global);
                    }
                }
            },
            error: function (data) {

                chk.removeClass('loading');
                $('.check_pay input[type="submit"]').prop('disabled', false);
                $('input[name="csrf_token"]').val(data.csrf);
                $('.check_pay .check').html(shopMessages[6]);
            }
        });

        event.preventDefault();
    });

    /**
     *
     * @param order_id
     * @param firstTime
     * @param confirmations
     * @param secret
     */
    function checkBTC(order_id, firstTime, confirmations, secret) {
        if (isiShop.variables.createPayment === false) return;
        var confirm = parseInt(confirmations) || 0;
        var btcIcon = $('.btcstatus-icon');

        $('.check_pay input[type="submit"]').prop('disabled', true);

        var ajaxCheckBTC = function (order_id, firstTime, confirmations, secret) {
            $.ajax({
                type: "POST",
                url: '/pay/btc/',
                data: 'order=' + order_id + '&first=' + parseInt(firstTime) + '&confirm=' + confirmations + '&secret=' + secret,
                dataType: "json",
                success: function (json) {
                    //$('input[name="csrf_token"]').val(json.csrf);

                    if (json.success) // all done 1 confirm
                    {
                        $('.btcstatus').removeClass('alert-info').addClass('alert-success').text(json.text);
                        $('.check_pay').show();
                        $('#pay').submit();
                        btcIcon.hide();
                        isiShop.variables.createPayment = false;
                    } else if (json.confirmations !== undefined) {
                        $('.btcstatus-info').hide();
                        $('.btcstatus').addClass('alert alert-info').text(json.text);
                        confirmations = json.confirmations + 1; // let check conf + 1
                    }

                    // дальше проверяем уже раз в 5 сек
                    if (!json.success) return checkBTC(order_id, 0, confirmations, secret);

                    if (json.errors)
                        if (json.errors.global)
                            alert(json.errors.global);
                },
                error: function (data) {
                    alert(shopMessages[6]);
                }
            });
        };

        // первая проверка через 30 сек после создания заказа
        if (firstTime == 1)
            setTimeout(function () {
                ajaxCheckBTC(order_id, firstTime, confirmations, secret);
            }, 30000);
        else
            setTimeout(function () {
                ajaxCheckBTC(order_id, firstTime, confirmations, secret);
            }, 5000);
    }


    //qiwi hack

    var $buttonQiwiPay = '<div style="margin:5px 0; text-align: right;"><input type="button" class="btn btn-default btn-primary js-qiwi-autocompleteform" value="' + shopMessages[7] + '" style="background: #3c5e84 !important;"></div>';

    $(document).on("ajaxStop", function (even) {
        if ($('#order [name="paymethod"]').val() === 'qiwi') {
            var $checkPay = $('#pay .check');
            if ($checkPay.length && !$checkPay.find('.js-qiwi-autocompleteform').length && $checkPay.html().length === 0) {
                $checkPay.closest('.check_pay').before($buttonQiwiPay);
            }
        }
        if ($('.js-qiwi-autocompleteform').length >= 2) {
            var lastel = $('.js-qiwi-autocompleteform').last();
            lastel.closest('div').remove();
        }
    });

    // window.onload = function() {
    //     if($('.js-qiwi-autocompleteform').length>1){
    //         $('#pay .check').last('.js-qiwi-autocompleteform').closest('div').remove();
    //     }
    // };

    $(document).on('click', '.js-qiwi-autocompleteform', function function_name(argument) {
        var $this = $(this);
        var $form = $this.closest('form');
        var $formTable = $this.find('.table');
        var $getSum = $form.find('.wow').text().split('.');
        var $getSumInteger = $getSum[0];
        var $getSumFraction = 0;
        if ($getSum.length === 2) {
            $getSumFraction = parseInt($getSum[1].replace(/\D+/g, ""));
            if (String($getSumFraction).length === 1) {
                $getSumFraction = parseInt($getSumFraction + "0");
            }
        }

        $getSumInteger = parseInt($getSumInteger.replace(/\D+/g, ""));

        var $getPhone = $form.find('.clipboard.form-control').eq(0).val();
        var $getComment = $form.find('.clipboard.form-control').eq(1).val();

        $getPhone = encodeURIComponent($getPhone);
        $getComment = encodeURIComponent($getComment);

        var $url = 'https://qiwi.com/payment/form/99?';
        $url += "amountInteger=" + $getSumInteger + "&amountFraction=" + $getSumFraction + "&extra['account']=" + $getPhone + "&extra['comment']=" + $getComment + "&blocked[0]=sum&blocked[1]=account&blocked[2]=comment";
        window.open($url, '_blank');
        return false;
    });

    // что то связанное с модалкой выбора типа оплаты в окне заказа
    $("#selectPay").on('click', function () {
        $('.pay-choose').fadeIn(300);
    });
    $('.pay-choose').each(function () {
        var $this = $(this);
        $(document).mouseup(function (e) { // событие клика по веб-документу
            var div = $this; // тут указываем ID элемента
            if (!div.is(e.target) // если клик был не по нашему блоку
                && div.has(e.target).length === 0) { // и не по его дочерним элементам
                $this.fadeOut(300);
            }
        });

    });

    //выбор типа оплаты в окне заказа
    $(".pay-choose input").on("click", function () {
        $('#order #selectPay').val($.trim($('input[type="radio"]:checked').closest('.pay-item').find('.pay-item__title').text()));
        $('#order #selectPayValue').val($('input[type="radio"]:checked').val());
        $('.pay-choose').fadeOut(300);
        var dataS = $('#order').closest('form').serialize();
        if (typeof isiShop != 'undefined') {
            var goodid = isiShop.variables.good_id;
            dataS = dataS + '&good_id=' + goodid;
        }
        $.post('/calculate', dataS, function (data) {
            var count = this.value || 0;
            $('.choose_popup #sum').text(isiShop.generateSum(count));
            if (data) {
                $('.choose_popup #sum').text(data);

                if ($('input[name="paymethod"]').val() == 'btc') {
                    $('#currency').text('btc');
                } else {
                    $('#currency').text('руб.');
                }
            }
        }, 'json');
    });


});
